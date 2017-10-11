var CorePlugin = require('./../corePlugin').CorePlugin,
  util = require('util'),
  utils = require('./../../utils/utils.js');

var sensor, model, interval;

var PirPlugin = exports.PirPlugin = function (params) {
  CorePlugin.call(this, params, 'pir', stop, simulate);
  model = this.model;
  this.addValue(true);
};
util.inherits(PirPlugin, CorePlugin);

function stop() {
  sensor.unexport();
};

function simulate() {
  this.addValue(false);
};

PirPlugin.prototype.createValue = function (data){
  return {"presence": data, "timestamp": utils.isoTimestamp()};
};


var oldValue = 0;
PirPlugin.prototype.connectHardware = function () {
  var Gpio = require('onoff').Gpio;
  var self = this;
  sensor = new Gpio(self.model.values.presence.customFields.gpio, 'in', 'both');
  interval = setInterval(function () {
	var value = sensor.readSync();
	if(oldValue !== value) {
		self.addValue(!!value);
		self.showValue();
		oldValue = value;
	}
  }, 500); // setInterval
  console.info('Hardware %s sensor started!', self.model.name);
};






