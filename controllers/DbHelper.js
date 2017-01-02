var settings = require('../settings.js');
var fs = require('fs');
var flow = require('flow');
var path = require('path');
var json2csv = require('json2csv');
var sqlite3 = require('sqlite3').verbose();
var babyparse = require('babyparse');
var common = require('./common.js');


var DbHelper = function() {
  this.file = path.join(settings.application.db);
  var exists = fs.existsSync(this.file);
  var db = new sqlite3.Database(this.file);
  var query = "CREATE TABLE IF NOT EXISTS _syncs (tablename TEXT NOT NULL, incoming TEXT NOT NULL, tablecolumn NOT NULL, columntype TEXT)"
  db.run(query, function(err){
      console.log(err);
  });
  db.close();
}

DbHelper.prototype.exportCsv = function(req, cb) {
  var db = new sqlite3.Database(this.file);
  var query = "SELECT * FROM " + req.params.tableName;
  db.all(query, function(err, rows){
    if (err) { cb(err) }
    else {
      try {
        var csv = json2csv({
          data: rows
        });
        cb(null, csv)
      } catch (err) {
        cb(err)
      }
    }
  });
  db.close();
}

DbHelper.prototype.importCsv = function(req, cb) {
  var self = this;

  var processCsv = flow.define(
    function(importFields, importData) {
      this.cb = cb;
      this.req = req;
      this.importData = importData // save to be used in the next function
      flow.serialForEach(importFields, function(val) {
        var columnName = val,
            columnKey = val + "_sync-column",
            typeKey = val + "_sync-type";
        // console.log(req.body[columnKey])
        if(req.body[columnKey] === "_new") {
          self.addColumn(req.params.tableName, columnName, req.body[typeKey], this)
        } else {
          common.logIt("not a new column, skipping..", this)
        }
      }, null, this);
    }
    ,function() {
      // there's gotta be a better way to store these var
      self.updatedCount = 0;
      self.failedUpdateCount = 0;
      self.insertCount = 0;
      flow.serialForEach(this.importData, function(obj){
        var columns = [];
        var values = [];
        var updates = [];
        var rowid = undefined;
        for(key in obj) {
          var cleaned = common.cleanString(key);
          var columnKey = cleaned + "_sync-column";
          var linked = (req.body[columnKey] === "_new") ? cleaned : req.body[columnKey];
          if(linked !== "rowid") {
            columns.push(linked);
            values.push(obj[key].replace("'","''")); // single quotes in a string screw up the sql query
            updates.push(linked + "='" + obj[key] + "'")
          } else {
            rowid = obj[key];
          }
        }
        var db = new sqlite3.Database(self.file);
        if(rowid) {
          var queryUpdate = "UPDATE " + req.params.tableName + " SET " + updates.join(", ") +
            " WHERE rowid=" + rowid;
            console.log(queryUpdate)
            db.run(queryUpdate, function(err, row){
                if(this.changes === 1){
                  self.updatedCount ++;
                }
            });
        } else {
          var queryInsert = "INSERT INTO " + req.params.tableName + " (" + columns.join(", ") + ") " + " VALUES ('" + values.join("', '") + "')";
          console.log(queryInsert);
          db.run(queryInsert, function(err){
            if(this.lastID){
              self.insertCount ++;
            }
          });
        }
        db.close(this);

      }, null, this)

    }
    ,function(){
      console.log("updated: " + self.updatedCount);
      console.log("inserted: " + self.insertCount);
      console.log("step 3")
      cb(null, "done");
    }
  );


  var csvString = req.file.buffer.toString('utf8');
  var parseOptions = {
    header: true,
    complete: function(results) {
      // returns an array of the column headers (cleaned to be alphanumeric and underscores)
      for (var i = 0, len = results.meta.fields.length; i < len; i++) {
        results.meta.fields[i] = common.cleanString(results.meta.fields[i])
      }
      processCsv(results.meta.fields, results.data)
    }
  }
  babyparse.parse(csvString, parseOptions);

}

DbHelper.prototype.listTables = function(cb) {
  var tables = [];
  var db = new sqlite3.Database(this.file);
  flow.exec(
    function() {
      db.all("SELECT name FROM sqlite_master WHERE type='table';", this)
    }
    ,function(err, rows) {
      // rows example... [ { name: 'lorem' }, { name: 'ipsum' } ]
      if(rows.length === 0 || err){
        cb(err, null);
      }
      for (var i = 0, len = rows.length; i < len; i++) {
        var query = "SELECT COUNT(*) AS count, '" + rows[i].name + "' AS name FROM " + rows[i].name + ";";
        db.get(query, this.MULTI())
      }
    }
    ,function(data){
      // data is an array of objects, one for each query, with obj[0] = err and obj[1] = row
      var tables = [];
      for (var i = 0, len = data.length; i < len; i++) {
        if (data[i][0]) {
          console.log('error: ' + data[i])
        }
        tables.push(data[i][1]);
      }
      db.close();
      cb(null, tables);
    }
  )
}

DbHelper.prototype.createTable = function(req, cb) {
  var systemTables = ["_syncs", "sqlite_sequence"]
  var tableName = req.body.tableName;
  if(systemTables.indexOf(tableName) === -1){
    var db = new sqlite3.Database(this.file);
    var query = "CREATE TABLE " + tableName +  " (rowid INTEGER PRIMARY KEY AUTOINCREMENT)";
    // http://sqlite.org/autoinc.html
    // With AUTOINCREMENT, rows with automatically selected ROWIDs are guaranteed
    // to have ROWIDs that have never been used before by the same table in the same database.
    db.run(query, function(err){
        cb(err);
    });
    db.close();
  } else {
    cb("table name is already used by the system.")
  }

}

DbHelper.prototype.dropTable = function(tableName, cb) {
  var db = new sqlite3.Database(this.file);
  var query = "DROP TABLE " + tableName;
  db.run(query, function(err){
      cb(err);
  });
  db.close();
}

DbHelper.prototype.selectAll = function(req, cb) {
  var db = new sqlite3.Database(this.file);
  var query = "SELECT * FROM " + req.params.tableName;
  db.all(query, function(err, rows){
      cb(err, rows);
  });
  db.close();
}

DbHelper.prototype.getColumns = function(req, cb) {
  var db = new sqlite3.Database(this.file);
  var query = "Pragma table_info(" + req.params.tableName + ")";
  db.all(query, function(err, rows){
      cb(err, rows);
  });
  db.close();
}

DbHelper.prototype.addColumn = function(tableName, columnName, columnType, cb) {
    var db = new sqlite3.Database(this.file);
    var query = "ALTER TABLE " + tableName + " ADD COLUMN " + columnName + " " + columnType;
    console.log(query)
    db.run(query, function(err){
        cb(err);
    });
    db.close();
}

DbHelper.prototype.addRow = function(req, cb) {
  var db = new sqlite3.Database(this.file);
  var query = "INSERT INTO " + req.params.tableName + "(";
  var columns = [],
      values  = [];
  for (key in req.body) {
    columns.push(key);
    values.push(req.body[key]);
  }
  query += columns.join(", ") + ") ";
  query += "VALUES ('" + values.join("', '") + "')";
  console.log(query)
  db.run(query, function(err){
      cb(err);
  });
  db.close();
}

DbHelper.prototype.getRow = function(req, cb) {
  var db = new sqlite3.Database(this.file);
  var query = "SELECT * FROM " + req.params.tableName +  " WHERE rowid = " + req.params.rowid;
  db.get(query, function(err, row){
      cb(err, row);
  });
  db.close();
}

DbHelper.prototype.updateRow = function(req, cb) {
  var db = new sqlite3.Database(this.file);
  var query = "UPDATE " + req.params.tableName + " SET ";
  var updates = [];
  for (key in req.body) {
    if(key !== "rowid" && key.indexOf("_") !== 0){
      updates.push(key + " = '" + req.body[key] + "'" )
    }
  }
  query += updates.join(", ");
  query += " WHERE rowid = " + req.params.rowid;
  console.log(query)
  db.run(query, function(err){
      cb(err);
  });
  db.close();
}

module.exports = DbHelper;
