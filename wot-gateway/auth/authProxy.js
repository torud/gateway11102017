var express = require('express');
var passport = require('passport');
var Strategy = require('passport-local').Strategy;
var db = require('./db');
var https = require('https');
var proxy = require('./middleware/proxy.js');
var proxyWebSockets = require('http-proxy');
var fs = require('fs');
var config = require('./config/config.json').config;
var configURL = require('./config/config.json').things[0].url;
var token = require('./config/config.json').things[0].token;
var path = require('path');
var cors = require('cors');
var flash = require('connect-flash');
var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var shell = require('shelljs');

/**
 * Changes behaviour if an error or a user fault (e.g. a wrong password) occurs
 * true: let the authorisation server use redirects (all pages have status code 200,
 * error messages are shown in text, the page you see in the browser is shown in the url line).
 * Preferably use this, when the application is integrated in the auth-server.
 * false: directly render the pages with a specific status code (e.g. 401, 420, 500 etc.),
 * the page is sometimes just a plain status code (after a POST /login with a wrong password),
 * the page you see in the browser is not always the one shown in the url line
 * (e.g. afer login, the profile page is shown, but the url line still contains /login)
 * Preferably use this, when the application is a local HTML file stored on the client's device.
 * Change the same variable in middleware/proxy.js (used for error when WoT-Server is offline)
 * (can not be accessed from here, despite being exported there)
 */
var useRedirects = true;

/**
 * If the application is integrated in the auth-server, this changes the behaviour if the client
 * GETs the /application ressource. Set to true if your application has mutliple HTML Files.
 * The application has to be in the folder multipage-application.
 */
var appHasMultipleHTMLFiles = false;

var keyFilePath = path.join(__dirname, 'config', 'privateKey.pem');
var key_file = fs.readFileSync(keyFilePath, 'utf8');

var caFilePath = path.join(__dirname, 'config', 'caCert.pem');
var cert_file = fs.readFileSync(caFilePath, 'utf8');

var passphrase = 'WoT-Gateway';

var tlsConfig = {
  key: key_file,
  cert: cert_file,
  passphrase: passphrase
};

var configPath = path.join(__dirname, 'config', 'config.json');

fs.watch(configPath, function (event, filename) {
  if (event == 'change') {
    updateToken();
  }
}); // fs.watch

function updateToken() {
  var authServerConfig = fs.readFileSync(configPath).toString();
  try {
    authServerConfig = JSON.parse(authServerConfig);
    token = authServerConfig.things[0].token;
    console.log('new API token: ' + token);
  } catch (e) {
    console.log('Could not parse authServer config file:');
    console.log(e);
    console.log(authServerConfig);
  }
} // updateToken

/**
 * Configure the local strategy for use by Passport.
 * 
 * The local strategy require a 'verify' function which receives the credentials
 * ('username' and 'password') submitted by the user. The function must verify
 * that the password is correct and then invoke 'done' with a user object, which
 * will be set at 'req.user' in route handlers after authentication.
 */
passport.use(new Strategy({
  passReqToCallback: true // allows us to pass back the entire request to the callback
},
  function (req, username, password, done) {
    db.users.checkPassword(password, function (err, user) {
      if (err) { return done(err); }
      if (!user) { return done(null, false, req.flash('loginMessage', 'Oops! Wrong password.')); }
      return done(null, user);
    });
  }));


/**
 * Configure Passport authenticated session persistence.
 * 
 * In order to restore authentication state across HTTP requests, Passport needs
 * to serialize users into and deserialize users out of the session. The
 * typical implementation of this is as simple as supplying the user ID when
 * serializing, and querying the user record by ID from the database when
 * deserializing.
 */
passport.serializeUser(function (user, done) {
  //console.log('serialize user with id ' + user.id);
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  //console.log('deserialize user with id ' + id);
  db.users.findById(id, function (err, user) {
    if (err) { return done(err); }
    done(null, user);
  });
});

// Create a new Express application
var app = express();

// Configure view engine to render EJS templates
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

morgan.token('date', function () {
  var date = new Date();
  //date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toString();
});

// Use application-level middleware for common functionality, including
// logging, parsing, and session handling
// don't log the /assets/* requests (is used when interacting with the device specific application)
app.use(morgan(':date :method :url :status :res[content-length] - :response-time ms', {
  skip: function (req, res) { return req.url.includes('/assets'); }
}));
app.use(cookieParser());
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(cors());
app.use(require('express-session')({ secret: 'Jozin z Bazin', resave: false, saveUninitialized: false }));
app.use(express.static(__dirname + '/views'));

// Initialize Passport and restore authentication state, if any, from the session
app.use(passport.initialize());
app.use(passport.session());
app.use(flash()); // use connect-flash for flash messages stored in session

// Define routes
app.get('/login',
  function (req, res) {
    res.render('login.ejs', { message: req.flash('loginMessage') });
  }); // GET /login

if (useRedirects) {
  /**
   * Authentication if user interacts via browser
   * (uses redirects and flash messages)
   */
  app.post('/login',
    passport.authenticate('local', {
      successRedirect: '/profile', // redirect to the secure profile section
      failureRedirect: '/login',
      failureFlash: true // allow flash messages
    })); // POST /login
} else {
  /**
   * Authentication if user interacts via Web App
   * (uses only HTTP status codes)
   */
  app.post('/login', function (req, res, next) {
    //console.log('Cookies: ', req.cookies);
    passport.authenticate('local', function (err, user, info) {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.sendStatus(401);
      }
      // log in the user
      req.logIn(user, function (err) {
        if (err) {
          return next(err);
        }
        // once login succeeded, return the current API token along with the profile page
        res.setHeader('Access-Control-Expose-Headers', ['Token', 'User']);
        res.setHeader('Token', token);
        // also send the user object, so the user of the web app can be identified
        res.setHeader('User', JSON.stringify(user));
        return res.render('profile', { user: req.user, message: req.flash('pwChangedMessage') });
      });
    })(req, res, next);
  }); // POST /login
}

app.get('/logout',
  function (req, res) {
    req.logout();
    res.redirect('/login');
  }); // GET /logout

app.get('/reset',
  function (req, res) {
    db.users.reset(function (err) {
      if (err) {
        req.flash('loginMessage', 'failed to reset password');
      } else {
        req.flash('loginMessage', 'Password reseted to factory settings. Please enter the password found in the operation manual.');
      }
      if (useRedirects) res.redirect('/login');
      else res.render('login', { message: req.flash('loginMessage') });
    });
  }); // GET /reset

app.get('/connectWiFi',
  function (req, res) {
    // req.flash('WiFiMessage', 'Test.');
    res.render('connectWiFi', { message: req.flash('WiFiMessage') });
  }); // GET /connectWiFi

app.post('/connectWiFi',
  function (req, res, next) {
    var password = req.body.password;
    var ssid = req.body.ssid;
    changeWiFiDongleToClient(ssid, password, function (success, message) {
      if (!success) {
        console.log('Resetting to hotspot mode and rebooting.');
        message += 'Resetting to hotspot mode and rebooting. Please wait some time and connect to the hotspot WiFi.';
        setTimeout(function () {
          changeWiFiDongleToHotspot();
        }, 2000);
      }
      console.log('rendering connectWifi with message ' + message);
      req.flash('WiFiMessage', message);
      res.render('connectWiFi', { message: req.flash('WiFiMessage') });
    });
  }); // POST /connectWiFi

app.get('/startHotspot',
  function (req, res, next) {
    changeWiFiDongleToHotspot(function (success) {
      if (success) {
        req.flash('loginMessage', 'Changed WiFi dongle to hotspot.');
      } else {
        req.flash('loginMessage', 'Failed to change WiFi dongle to hotspot.');
      }
      res.redirect('/login');
    });
  }); // GET /startHotspot

/**
 * Changes the WiFi dongle to client mode, so it can connect to an
 * existing wireless network with the given ssid and password.
 * Runs the callback (if defined) with the parameter success = true if everything went well
 * with a message from the shell command.
 * @param {*} ssid 
 * @param {*} password 
 * @param {*} callback 
 */
function changeWiFiDongleToClient(ssid, password, callback) {
  console.log('Running script to change wifi dongle to client');
  var scriptFilePath = path.join(__dirname, 'changeWiFiDongleToClient.sh');
  shell.exec(scriptFilePath, function (code, stdout, stderr) {
    console.log('Exit code:', code);
    console.log('Program output:', stdout);
    console.log('Program stderr:', stderr);
    if (code !== 0) {
      console.log('failed to connect to WiFi ' + ssid);
      if (callback) callback(false, stderr);

    } else {
      console.log('Trying to connect to WiFi ' + ssid + ' with password ' + password);
      shell.exec('sudo nmcli dev wifi connect ' + ssid + ' password ' + password, function (code, stdout, stderr) {
        console.log('Exit code:', code);
        console.log('Program output:', stdout);
        console.log('Program stderr:', stderr);
        if (code !== 0 || stdout.includes('Error')) {
          console.log('failed to connect to WiFi ' + ssid);
          if (callback) callback(false, stderr + ' ' + stdout);
        } else {
          console.log('connected to WiFi ' + ssid);
          if (callback) callback(true, stdout);
        }
      }); // connect to wifi
    }
  }); // run shell script
} // changeWiFiDongleToClient

/**
 * Changes the WiFi dongle to hotspot mode, so it sets up a own wireless network.
 * Runs the callback (if defined) with the parameter success = true if everything went well.
 * @param {*} callback 
 */
function changeWiFiDongleToHotspot(callback) {
  console.log('Running script to change wifi dongle to hotspot');
  var scriptFilePath = path.join(__dirname, 'changeWiFiDongleToHotspot.sh');
  shell.exec(scriptFilePath, function (code, stdout, stderr) {
    console.log('Exit code:', code);
    console.log('Program output:', stdout);
    console.log('Program stderr:', stderr);
    if (code !== 0) {
      console.log('Failed to change WiFi dongle to hotspot.');
      if (callback) callback(false);
    } else {
      console.log('Changed WiFi dongle to hotspot.');
      if (callback) callback(true);
    }
  }); // run shell script
} // changeWiFiDongleToHotspot

/**
 * custom authorisation middleware, checks if user is authenticated.
 * Uses either only status code 401 (if client interacts via a Web App)
 * or redirects to login (when client interacts with a browser)
 */
function isAuthenticated() {
  return function (req, res, next) {
    // if the request is neither authorized via cookie
    // nor the right token and user-object in the header, send a plain 401 status
    // console.log('Authorization: ' + req.get('authorization'));
    // console.log('isAuthenticated: ' + req.isAuthenticated());
    // console.log('user: ' + req.get('user'));
    if ((!req.isAuthenticated || !req.isAuthenticated()) &&
      (!isTokenValid(req) || !hasUserHeader(req))) {
      // console.log('Request is NOT authenticated!');
      // console.log('Token is valid: ' + isTokenValid(req));
      // console.log('User header is present: ' + hasUserHeader(req));
      if (useRedirects) return res.redirect('/login');
      else return res.sendStatus(401);
    }
    // console.log('Request is authenticated!');
    next();
  }
} // isAuthenticated

app.use(isAuthenticated()); // authorisation middleware

function isTokenValid(req) {
  var reqToken = req.body.token || req.get('authorization') ||
    req.query.token || req.headers['Authorization'];
  // console.log('checking if token is valid, because it is:');
  // console.log(reqToken == token);
  return reqToken == token;
} // isTokenValid

function hasUserHeader(req) {
  //console.log('checking if user header is present');
  var reqUser = req.body.user || req.get('user') ||
    req.query.user || req.headers['user'];
  if (reqUser) {
    try {
      reqUser = JSON.parse(reqUser);
      if (reqUser.id >= 0) {
        // add the user object to the user-property of the request,
        // so the following middlewares can use it (useful for /editProfile)
        req.user = reqUser;
        return true;
      }
      return false;
    } catch (e) {
      console.log(e);
      return false;
    }
  } else {
    return false;
  }
} // hasUserHeader

// beyond this line, all routes can only be accessed if the user is logged in
// or authenticated via token & user in the request header

app.get('/profile',
  function (req, res) {
    res.render('profile', { user: req.user, message: req.flash('pwChangedMessage') });
  }); // GET /profile

app.get('/editProfile',
  function (req, res) {
    // console.log('user: ' + JSON.stringify(req.user));
    res.render('editProfile', { user: req.user, message: req.flash('pwChangeFailedMessage') });
  }); // GET /editProfile


app.post('/editProfile',
  function (req, res) {
    var id = req.user.id;
    var oldPassword = req.body.oldPassword;
    var newPassword = req.body.newPassword;
    var confirmPassword = req.body.confirmPassword;

    db.users.changePassword(id, oldPassword, newPassword, confirmPassword,
      function (success, message) {
        if (!success) {
          console.log('did not change password');
          req.flash('pwChangeFailedMessage', message);
          res.status(420);  // Policy Not Fulfilled
          if (useRedirects) res.redirect('/editProfile');
          else res.render('editProfile', { user: req.user, message: req.flash('pwChangeFailedMessage') });
        } else {
          console.log('successfully changed password');
          req.flash('pwChangedMessage', message);
          if (useRedirects) res.redirect('/profile');
          else res.render('profile', { user: req.user, message: req.flash('pwChangedMessage') });
        }
      }); // changePassword
  }); // POST /editProfile

if (useRedirects) {
  app.get('/application',
    function (req, res) {
      // console.log('Client wants a /application Ressource');
      if (appHasMultipleHTMLFiles) {
        // application has mulitple html pages
        res.sendFile(path.join(__dirname + '/multipage-application/index.html'));
      } else {
        // application is a single html page
        res.render('sauna/application');
      }
    }); // GET /application

  if (appHasMultipleHTMLFiles) {
    app.get('/*.html',
      function (req, res) {
        // console.log('GET *.html: ' + req.url);
        res.sendFile(path.join(__dirname + '/multipage-application' + req.url));
      }); // GET /*.html

    app.get('/assets/*',
      function (req, res) {
        // console.log('GET assets/*: ' + req.url);
        res.sendFile(path.join(__dirname + '/multipage-application' + req.url));
      }); // GET /assets/*
  }
}

app.get('/error',
  function (req, res) {
    res.render('error', { user: req.user, message: req.flash('errorMessage') });
  }); // GET /error

// add the proxy server middleware, which adds the API-Token of the
// WoT-Server to the request and proxy all requests and responses
app.use(proxy());

var httpServer = https.createServer(tlsConfig, app);

// add support for websockets (had to be done here and not in middleware/proxy.js
// because of the httpServer object)
var proxyServer = proxyWebSockets.createProxyServer({ //#B
  tlsConfig,
  target: configURL,
  ws: true,
  secure: false //#C
});

httpServer.on('upgrade', function (req, socket, head) {
  // console.log('Upgrading to WebSockets!');
  req.url += '?token=' + token;
  // console.log(req.url);
  proxyServer.ws(req, socket, head, function (e) {
    // an error occurred
    console.log('error in authServer WebSocket proxy:');
    console.log(e);
  });

});

// Don't show the whole call stack in the response if there's an error
app.use(function (error, req, res, next) {
  if (error) {
    console.log(error);
    if (useRedirects) {
      req.flash('errorMessage', 'Internal Server Error');
      res.redirect('/error');
    } else {
      res.sendStatus(500);    // Internal Server Error
    }
  } else {
    next();
  }
});

httpServer.listen(config.sourcePort, function () {
  console.log('WoT Authentication Proxy started on port: %d', config.sourcePort);
});

