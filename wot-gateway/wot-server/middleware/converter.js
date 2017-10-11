var msgpack = require('msgpack5')(),
  encode = msgpack.encode,
  model = require('./../resources/model');

module.exports = function () {
  return function (req, res, next) {
    if (req.result) {

      req.rooturl = req.headers.host;
      req.qp = req._parsedUrl.search;

      if (req.accepts('html')) {

        var helpers = {
          json: function (object) {
            return JSON.stringify(object);
          },
          getById: function (object, id) {
            return object[id];
          }
        };

        // Check if there's a custom renderer for this media type and resource
        if (req.type) res.render(req.type, { req: req, helpers: helpers });
        else res.render('default', { req: req, helpers: helpers });

        return;
      }

      if (req.accepts('application/x-msgpack')) {
        // console.info('MessagePack representation selected!');
        res.type('application/x-msgpack');
        res.send(encode(req.result));
        return;
      }

      if (req.accepts('application/ld+json')) {
        // console.info('JSON-ld representation selected!');
        res.send(model);
        return;
      }

      if (req.accepts('application/json')) {
        // console.info('JSON representation selected!');
        res.type('application/json');
        res.send(req.result);
        return;
      }

      // console.info('Defaulting to JSON representation!');
      res.send(req.result);
      return;

    }
    else if (res.location) {
      res.status(204).send();
      return;
    } else {
      next();
    }
  }
};

