var settings = require('./settings.js');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');

// bodyParser() to let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var DbHelper = require('./controllers/DbHelper.js');
var dbHelper = new DbHelper();

var router = express.Router();

// middleware to use for all requests
router.use(function(req, res, next) {
  console.log();
  next();
});


// TO DO
// #####
// figure out error handling for the API
// https://github.com/AmericanRedCross/OpenMapKitServer/blob/master/api/odk/controllers/get-csv-submissions.js
// ???
// 200 - OK
// 404 - Not Found
// 500 - Internal Server Error
// https://apigee.com/about/blog/technology/restful-api-design-what-about-errors


// should i send the response to the exportCsv function and do stuff there?
// like set status and Content-Type and whatnot there?
router.route('/csv/:tableName')
  .get(function(req, res) {
    dbHelper.exportCsv(req, function(err, data){
      if(err) { res.send(err); }
      res
        .status(200)
        .set('Content-Type', 'text/csv')
        .send(data);
    });
  });

router.route('/tables')
  // get all table names with row counts
  .get(function(req, res) {
    dbHelper.listTables(function(err, data){
      if(err) { res.send(err); }
      res.json(data);
    });
  })
  .post(function(req, res) {
    switch(req.body["_method"]) {
      // delete a table
      case "delete":
        var tableName = req.body.tableName;
        console.log(tableName)
        dbHelper.dropTable(tableName, function(err){
          if(err) { res.send(err); }
          else { res.send("table deleted"); }
        });
        break;
      // create a table
      default:
        dbHelper.createTable(req, function(err){
          if(err) { res.send(err); }
          else { res.send("table created") }
        });
        break;
    }
  })


router.route('/tables/:tableName')
  // get all the columns for a table
  .get(function(req, res) {
    dbHelper.getColumns(req, function(err, data) {
      if(err) { res.send(err); }
      res.json(data);
    });
  })
  .post(function(req, res) {
    switch(req.body["_method"]) {
      // delete column from a table
      case "delete":
        // ...
        // http://stackoverflow.com/questions/5938048/delete-column-from-sqlite-table
        break;
      // add a column to a table
      default:
        dbHelper.addColumn(req.params.tableName, req.body.columnName, req.body.columnType, function(err) {
          if(err) { res.send(err); }
          if(!err) { res.send("column added"); }
        });
        break;
    }
  })

var multer  = require('multer');
var storage = multer.memoryStorage();
var upload = multer({ storage : storage }).single('csvFile');

router.route('/tables/:tableName/import')
  // import a CSV
  .post(function(req, res) {
    upload(req,res,function(err) {
      dbHelper.importCsv(req, function(err, data){
        res.send(data)
      });
    })
  })

router.route('/tables/:tableName/rows')
  // get all row data for a table
  .get(function(req, res) {
    dbHelper.selectAll(req, function(err, data) {
      if(err) { res.send(err); }
      res.json(data);
    });
  })
  // create new row in a table
  .post(function(req, res) {
    dbHelper.addRow(req, function(err) {
      if(err) { res.send(err); }
      if(!err) { res.send("row added"); }
    });
  })

router.route('/tables/:tableName/rows/:rowid')
  // get data for a single row in a table
  .get(function(req, res) {
    dbHelper.getRow(req, function(err, data) {
      if(err) { res.send(err); }
      res.json(data);
    });
  })
  // update a single row in a table
  .post(function(req, res) {
    switch(req.body["_method"]) {
      case "delete":
        // ...
        // delete a single row in a table
        // will need to preserve odk UUID so as to not reimport
        break;
      case "put":
        dbHelper.updateRow(req, function(err, data) {
          if(err) { res.send(err); }
          if(!err) { res.send("row updated"); }
        });
        break;
      default:
        // ...
        break;
    }
  })

app.use('/api', router);
app.use(express.static('pages'))

var port = process.env.PORT || settings.application.port;
app.listen(port, function() {
  console.log('listening on port ' + settings.application.port)
});
