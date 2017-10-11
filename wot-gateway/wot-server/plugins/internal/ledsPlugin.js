var CorePlugin = require('./../corePlugin').CorePlugin,
  util = require('util'),
  utils = require('./../../utils/utils.js');
//var SerialPort = require('serialport');
//var port = new SerialPort('/dev/ttyUSB0');

var actuator, model;
var oldStateLED1 = false;
var oldStateLED2 = false;

var LedsPlugin = exports.LedsPlugin = function (params) { //#A
  CorePlugin.call(this, params, 'leds',
    stop, simulate, ['ledState'], switchOnOff); //#B
  model = this.model;		// model = /model.links.properties.resources.leds
  this.addValue(false);
};
util.inherits(LedsPlugin, CorePlugin); //#C

function switchOnOff(value) {	// value = eintrag in /model.links.actions.resources.ledState.data
  var self = this;
  var actuator;
  var valID = parseInt(value.ledID);
  if (!this.params.simulate) {
    switch (valID) {
      case 1: actuator1.write(value.state === true ? 1 : 0, function () {
        self.addValue(value); //#D
      });
        oldStateLED1 = value.state;
        break;
      case 2: actuator2.write(value.state === true ? 1 : 0, function () {
        self.addValue(value); //#D
      });
        oldStateLED2 = value.state;
        break;
      default: console.log('Default changing LED 2! ID requested: %s', value.ledID);
        actuator2.write(value.state === true ? 1 : 0, function () {
          self.addValue(value); //#D
        });
        oldStateLED2 = value.state;
        break;
    }

  } else { // Simulation
    self.addValue(value);
  }
  value.status = 'completed'; //#E
  // value.ledID ist z.B. 1 --> self.model.values.1.name ist dann "LED 1"
  console.info('Changed value of %s to %s', self.model.values[value.ledID].name, value.state);

  // Ausgabe über serielle Schnittstelle (USB to RS232 Converter)
	/* var message = 'Changed value of ' + self.model.values[value.ledID].name + ' to ' + value.state + '\r\n';
	port.write(message, function(err) {
		if (err) {
		  return console.log('Error on write: ', err.message);
		}
	}); */


}; // switchOnOff

function stop() {
  actuator1.unexport();
  actuator2.unexport();
};

function simulate() {
  this.addValue(false);
};

LedsPlugin.prototype.createValue = function (data) {
  var changedLED = parseInt(data.ledID);
  var newValue = data.state;
  switch (changedLED) {
    case 1: return { "LED1": newValue, "LED2": oldStateLED2, "timestamp": utils.isoTimestamp() };
    case 2: return { "LED1": oldStateLED1, "LED2": newValue, "timestamp": utils.isoTimestamp() };
    default: return { "LED1": newValue, "LED2": oldStateLED2, "timestamp": utils.isoTimestamp() };
  }
};

LedsPlugin.prototype.connectHardware = function () { //#F
  var Gpio = require('onoff').Gpio; //#G
  var self = this;
  actuator1 = new Gpio(self.model.values['1'].customFields.gpio, 'out');
  actuator2 = new Gpio(self.model.values['2'].customFields.gpio, 'out');
  console.info('Hardware %s actuator started!', self.model.name);
};

//#A Call the initalization function of the parent plugin (corePlugin.js)
//#B Pass it the property you’ll update (leds) and the actions you want to observe (ledState) as well as the implementation of what to do when a ledState action is created (switchOnOff)
//#C Make the LedsPlugin inherit from all the corePlugin.js functionality
//#D Add a new data entry to the property in the model
//#E Change status to 'completed' as the LED state was changed
//#F Extend the function connectHardware of corePlugin.js
//#G Change the state of the LED using the on/off library

