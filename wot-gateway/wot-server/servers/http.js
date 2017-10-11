var express = require('express'),
  routesCreator = require('./../routes/routesCreator'),
  resources = require('./../resources/model'),
  converter = require('./../middleware/converter'),
  auth = require('./../middleware/auth'),
  keys = require('../resources/auth'),
  bodyParser = require('body-parser'),
  cons = require('consolidate'),
  utils = require('./../utils/utils'),
  cors = require('cors'),
  favicon = require('serve-favicon'),
  fs = require('fs'),
  path = require('path'),
  morgan = require('morgan');
// const debug = require('debug')('my-namespace')
// const name = 'my-app'
// debug('booting %s', name);

morgan.token('date', function () {
  var date = new Date();
  //date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toString();
});

var app = express();
app.use(morgan(':date :method :url :status :res[content-length] - :response-time ms'));
app.use(bodyParser.json({ strict: false }));

// Don't show the whole call stack in the response
// if there's a syntax error in the body of the request
app.use(function (error, req, res, next) {
  if (error instanceof SyntaxError) {
    res.sendStatus(400);    // Bad Request
  } else {
    next();
  }
});

app.use(cors());

app.use(favicon(__dirname + './../public/images/favicon-96x96.png'));

if (resources.customFields.secure === true) {
  var token = keys.apiToken;
  var oldToken = keys.apiToken;
  if (resources.customFields.generateNewAPIToken === true) {
    // generate a new random Token
    token = utils.generateApiToken();
    // update the API-Token here
    keys.apiToken = token;  // will also be updated in middleware/auth.js for some reason
  }
  // always update the API- Token in the authorisation server
  var configFilePath = path.join(__dirname, '..', '..', 'auth', 'config', 'config.json');
  var authServerConfig = fs.readFileSync(configFilePath, 'utf8').toString();
  try {
    authServerConfig = JSON.parse(authServerConfig);
    authServerConfig.things[0].token = token;
  } catch (e) {
    console.log('Could not parse authServerConfigFile! Using default API-Token!');
    keys.apiToken = oldToken;
    authServerConfig = {
      "things": [
        {
          "id": "WoTnanoPi",
          "url": "https://127.0.0.1:8484",
          "token": oldToken
        }
      ],
      "config": {
        "sourcePort": 443
      }
    }
  } // catch
  fs.writeFile(configFilePath, JSON.stringify(authServerConfig), 'utf8');
  console.info('current API Token is: ' + keys.apiToken);
  app.use(auth()); // enable the auth middleware
} // if

// Create Routes
app.use('/', routesCreator.create(resources));

// Templating engine
app.engine('html', cons.handlebars);
app.set('view engine', 'html');
app.set('views', __dirname + '/../views');
// Sets the public folder (for static content such as .css files & co)
app.use(express.static(__dirname + '/../public'));

app.use(converter());

// Don't show the whole call stack in the response if there's an error
app.use(function (error, req, res, next) {
  if (error) {
    console.log(error);
    if (error instanceof TypeError) {
      res.sendStatus(404);  // Not Found
    } else {
      res.sendStatus(500);  // Internal Server Error
    }
  } else {
    next();
  }
});

module.exports = app;