var express = require('express'),
  router = express.Router(),
  uuid = require('node-uuid'),
  utils = require('./../utils/utils');

exports.create = function (model) {

  createDefaultData(model.links.properties.resources);
  createDefaultData(model.links.actions.resources);

  // Let's create the routes
  createRootRoute(model);
  createModelRoutes(model);
  createPropertiesRoutes(model);
  createActionsRoutes(model);
  createThingsRoutes(model);

  return router;
};


function createRootRoute(model) {
  router.route('/').get(function (req, res, next) {

    req.model = model;
    req.type = 'root';

    var fields = ['id', 'name', 'description', 'tags', 'customFields'];
    req.result = utils.extractFields(fields, model);

    if (model['@context']) type = model['@context'];
    else type = 'http://model.webofthings.io/';

    res.links({
      model: '/model/',
      properties: '/properties/',
      actions: '/actions/',
      things: '/things/',
      help: '/help/',
      ui: '/',
      type: type
    });

    next();
  });
};


function createModelRoutes(model) {
  // GET /model
  router.route('/model').get(function (req, res, next) {
    req.result = model;
    req.model = model;

    if (model['@context']) type = model['@context'];
    else type = 'http://model.webofthings.io/';
    res.links({
      type: type
    });

    next();
  });
};

function createPropertiesRoutes(model) {
  var properties = model.links.properties;

  // GET /properties
  router.route(properties.link).get(function (req, res, next) {
    req.model = model;
    req.type = 'properties';
    req.entityId = 'properties';

    req.result = utils.modelToResources(properties.resources, true);

    // Generate the Link headers 
    if (properties['@context']) type = properties['@context'];
    else type = 'http://model.webofthings.io/#properties-resource';

    res.links({
      type: type
    });

    next();
  });

  // GET /properties/{id}
  router.route(properties.link + '/:id').get(function (req, res, next) {
    req.model = model;
    req.propertyModel = properties.resources[req.params.id];
    req.type = 'property';
    req.entityId = req.params.id;

    req.result = reverseResults(properties.resources[req.params.id].data);

    // Generate the Link headers 
    if (properties.resources[req.params.id]['@context']) type = properties.resources[req.params.id]['@context'];
    else type = 'http://model.webofthings.io/#properties-resource';

    res.links({
      type: type
    });

    next();
  });
};

function createActionsRoutes(model) {
  var actions = model.links.actions;

  // GET /actions
  router.route(actions.link).get(function (req, res, next) {
    req.result = utils.modelToResources(actions.resources, true);

    req.model = model;
    req.type = 'actions';
    req.entityId = 'actions';

    if (actions['@context']) type = actions['@context'];
    else type = 'http://model.webofthings.io/#actions-resource';

    res.links({
      type: type
    });

    next();
  });

  // POST /actions/{actionType}
  router.route(actions.link + '/:actionType').post(function (req, res, next) {
    // Auszuführende Action aus dem Request-Body entnehmen und Zusatzinfos hinzufügen
    var action = { command: req.body };
    // if (typeof action.command !== 'string') {
    //   console.log('Action-Command JSON received: ' + JSON.stringify(action.command));
    // } else {
    //   console.log('Action-Command String received: ' + action.command);
    // }

    action.id = uuid.v1();
    action.status = "pending";
    action.timestamp = utils.isoTimestamp();
    // Aktion in das Array data des entsprechenden actionTypes einfügen
    // (data-Array wurde in createDefaultData automatisch erzeugt)
    // console.log(req.params);
    // console.log('Actions-Array:');
    // console.log(actions.resources[req.params.actionType]);
    // console.log('Füge folgende action hinzu:');
    // console.log(JSON.stringify(action));
    utils.cappedPush(actions.resources[req.params.actionType].data, action);
    res.location(req.originalUrl + '/' + action.id);
    next();
  });


  // GET /actions/{actionType}
  router.route(actions.link + '/:actionType').get(function (req, res, next) {

    req.result = reverseResults(actions.resources[req.params.actionType].data);
    req.actionModel = actions.resources[req.params.actionType];
    req.model = model;

    req.type = 'action';
    req.entityId = req.params.actionType;

    if (actions.resources[req.params.actionType]['@context']) type = actions.resources[req.params.actionType]['@context'];
    else type = 'http://model.webofthings.io/#actions-resource';

    res.links({
      type: type
    });


    next();
  });

  // GET /actions/{id}/{actionId}
  router.route(actions.link + '/:actionType/:actionId').get(function (req, res, next) {
    // console.log('GET ' + req.params.actionId);
    // console.log('Find in Array "data" of following object:');
    // console.log(actions.resources[req.params.actionType]);
    // console.log('This Object: ' + JSON.stringify( { "id": req.params.actionId }));
    req.result = utils.findObjectInArray(actions.resources[req.params.actionType].data,
      { "id": req.params.actionId });
    next();
  });
};

function createThingsRoutes(model) {
  // GET /things
  router.route('/things').get(function (req, res, next) {
    req.result = model.things;
    req.model = model;

    if (model['@context']) type = model['@context'];
    else type = 'http://model.webofthings.io/';
    res.links({
      type: type
    });

    next();
  });

  // GET /things/{thingType}
  router.route('/things' + '/:thingType').get(function (req, res, next) {

    req.result = model.things[req.params.thingType];
    req.thingModel = model.things[req.params.thingType];
    req.model = model;

    req.type = 'thing';
    req.entityId = req.params.thingType;

    if (model.things[req.params.thingType]['@context']) type = model.things[req.params.thingType]['@context'];
    else type = 'http://model.webofthings.io/#things-resource';

    res.links({
      type: type
    });


    next();
  });
};

// creates an empty data-Array for each key
function createDefaultData(resources) {
  Object.keys(resources).forEach(function (resKey) {
    var resource = resources[resKey];
    resource.data = [];
  });
}

function reverseResults(array) {
  return array.slice(0).reverse();
}



