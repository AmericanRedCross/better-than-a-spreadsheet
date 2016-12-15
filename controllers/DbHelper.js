var settings = require('../settings.js');
var fs = require('fs');
var flow = require('flow');
var path = require('path');
var json2csv = require('json2csv');
var sqlite3 = require('sqlite3').verbose();


var DbHelper = function() {
  this.file = path.join(settings.application.db);
  var exists = fs.existsSync(this.file);
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
  var tableName = req.body.tableName;
  var db = new sqlite3.Database(this.file);
  var query = "CREATE TABLE " + tableName +  " (rowid INTEGER PRIMARY KEY)"; // alias for for ROWID [http://sqlite.org/autoinc.html]
  db.run(query, function(err){
      cb(err);
  });
  db.close();
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

DbHelper.prototype.addColumn = function(req, cb) {
    var db = new sqlite3.Database(this.file);
    var query = "ALTER TABLE " + req.params.tableName + " ADD COLUMN " + req.body.columnName + " " + req.body.columnType;
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
