var https = require('https'),
  fs = require('fs'),
  config = require('../config/config.json').things[0], //#A
  httpProxy = require('http-proxy');
var path = require('path');

// for description see authProxy.js
var useRedirects = true;

var keyFilePath = path.join(__dirname, '..', 'config', 'privateKey.pem');
var key_file = fs.readFileSync(keyFilePath, 'utf8');

var caFilePath = path.join(__dirname, '..', 'config', 'caCert.pem');
var cert_file = fs.readFileSync(caFilePath, 'utf8');

var passphrase = 'WoT-Gateway';

var tlsConfig = {
  key: key_file,
  cert: cert_file,
  passphrase: passphrase
};

var proxyServer = httpProxy.createProxyServer({ //#B
  tlsConfig,
  secure: false //#C
});

console.log('API Token of the authProxy server: ' + config.token);

var configPath = path.join(__dirname, '..', 'config', 'config.json');

fs.watch(configPath, function (event, filename) {
  if (event == 'change') {
    updateToken();
  }
}); // fs.watch

function updateToken() {
  var authServerConfig = fs.readFileSync(configPath).toString();
  try {
    authServerConfig = JSON.parse(authServerConfig);
    config.token = authServerConfig.things[0].token;
    console.log('new API token: ' + config.token);
  } catch (e) {
    console.log(e);
  }
} // updateToken

module.exports = function () {
  return function proxy(req, res, next) {
    req.headers['authorization'] = config.token; //#D
    proxyServer.web(req, res, { target: config.url }, function (e) {
      // an error occurred
      console.log('error in proxy:');
      console.log(e);
      req.flash('errorMessage', 'The server of the Web Thing is offline!');
      if (useRedirects) {
        console.log('proxy: using redirect to /error');
        res.redirect('/error');
      } else {
        console.log('proxy: render /error directly');
        res.status(502);  // Bad Gateway
        res.render('error', { message: req.flash('errorMessage') });
      }
    }); //#E
  } // proxy
};

//#A Load the Thing that can be proxied (there’s just one here)
//#B Initialize the proxy server, making it an HTTPS proxy to ensure end-to-end encryption
//#C Do not verify the certificate (true would refuse local certificate)
//#D Proxy middleware function; add the secret token of the Thing
//#E Proxy the request; notice that this middleware doesn’t call next() because it should be the last in the chain
