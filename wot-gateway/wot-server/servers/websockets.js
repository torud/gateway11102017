var WebSocketServer = require('ws').Server,
  url = require('url'),
  resources = require('./../resources/model'),
  utils = require('./../utils/utils');

exports.listen = function (server, secure) {
  var wss = new WebSocketServer({ server: server }); //#A
  console.info('WebSocket server started...');
  wss.on('connection', function (ws) { //#B
    var reqUrl = url.parse(ws.upgradeReq.url, true);
    if (secure && !utils.isTokenValid(reqUrl.query.token)) {
      ws.send(JSON.stringify({ 'error': 'Invalid access token.' }));
    } else {
      try {
        Array.observe(selectResouce(reqUrl.pathname), function (changes) { //#C
          ws.send(JSON.stringify(changes[0].object[changes[0].object.length - 1]), function () {
            //console.log(JSON.stringify(changes[0].object[changes[0].object.length - 1]));
          });
        }, ['add'])
      } catch (e) { //#D
        console.log('Unable to observe %s resource!', url);
      }
    }
  });
};

function selectResouce(url) { //#E
  var parts = url.split('/');
  parts.shift();
  var result;
  if (parts[0] === 'actions') {
    result = resources.links.actions.resources[parts[1]].data;
  } else if (parts[0] === 'properties') {
    result = resources.links.properties.resources[parts[1]].data;
  } else {
    result = resources.things[parts[1]];
  }
  //console.log('WebSocket server observing ' + JSON.stringify(result));
  return result;
}

//#A Create a WebSocket server by passing it the Express server
//#B Triggered after a protocol upgrade when the client connected
//#C We register an observer corresponding to the resource in the protocol upgrade URL
//#D We use a try/catch to catch to intercept error (e.g., malformed/unsupported URLs)
//#E This function takes a request URL and returns the corresponding resource


