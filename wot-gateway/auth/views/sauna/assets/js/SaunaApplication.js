/**
 * JavaScript code Application-Website Kueng Sauna on the WoT-Gateway
 * 
 * @author: Thierry Durot, thierry.durot@ntb.ch
 * @author: Joël Lutz, joel.lutz@ntb.ch
 */

// -------------------------- global variables --------------------------
var td = top.document;
var serverLocation = window.location;
var postActionStatus = 204;
var wsURL = '';
var webSocket;

var tarTemp;
var tarHum;
var tarDur;

// -------------------------- predefined sauna commands --------------------------
var stopSauna = { "cmd": { "id": 1 } };

// -------------------------- sauna commands --------------------------
// choose type of sauna
$('#selectBtn').on('change', function () {
      getSelectedOption();
});

// sends the command to start/stop the sauna
$('#switchSauna').on('change', function () {
      tarTemp = td.getElementById('targetTemp').value;
      tarHum = td.getElementById('targetHum').value;
      tarDur = td.getElementById('targetDur').value;
      if ((tarTemp && tarHum && tarDur) != null) {
            if (td.getElementById('switchSauna').checked) {
                  var command = '{"cmd":{"id":0,"temp":' + tarTemp + ',"hum":' + tarHum + ',"dur":' + tarDur + '}}';
            } else {
                  var command = JSON.stringify(stopSauna);
            }
            postSendCommand(command, 'start/stop sauna');
      } else {
            td.getElementById('switchSauna').checked = false;
      }
});

// update target values
$('#targetTemp').on('change', function () {
      tarTemp = td.getElementById('targetTemp').value;
      var command = '{"par":{"rw":1,"id":0,"val":' + tarTemp + '}}';
      postSendCommand(command, 'start/stop sauna on change temp');
});

$('#targetHum').on('change', function () {
      tarHum = td.getElementById('targetHum').value;
      var command = '{"par":{"rw":1,"id":1,"val":' + tarHum + '}}';
      postSendCommand(command, 'start/stop sauna on change hum');
});

$('#targetDur').on('change', function () {
      tarDur = td.getElementById('targetDur').value;
      var command = '{"par":{"rw":1,"id":4,"val":' + tarDur + '}}';
      postSendCommand(command, 'start/stop sauna on change dur');
});

// change light via slider
$('#levelLight').on('change', function () {
      var levLight = td.getElementById('levelLight').value;
      var command = '{"par":{"rw":1,"id":5,"val":' + levLight + '}}';
      postSendCommand(command, 'change light');
});


// -------------------------- properties (with WebSockets) --------------------------
$(document).ready(function () {
      var request = new XMLHttpRequest();
      request.open("GET", '/properties/sauna', true);
      request.setRequestHeader("Accept", "application/json; charset=utf-8");
      request.onreadystatechange = function () {
            if (request.readyState === XMLHttpRequest.DONE) {
                  properties = JSON.parse(request.responseText)[0];
                  displayVal(properties);
                  getSelectedOption();
            }
      }
      request.send(null);
}); // document ready

wsURL = 'wss://' + serverLocation.host + '/properties/sauna';
webSocket = new WebSocket(wsURL);

webSocket.onmessage = function (event) {
      var result = JSON.parse(event.data);
      displayVal(result);
}

webSocket.onerror = function (error) {
      console.error('WebSocket error!');
      console.error(error);
}


// -------------------------- help functions --------------------------
/**
 * Sends a HTTP-POST to /actions/sendCommand if the command isn't undefined.
 * Displays a message with the specified name.
 * Runs the callback (if defined) with success = true if the desired answer from the WoT-Gateway (204)
 * is received, along with the request object.
 * @param {*} command   The command to send as a string
 * @param {*} name      The name of the command to display in answerStatus
 * @param {*} callback  If defined: Gets called after an answer is received
 */
function postSendCommand(command, name, callback) {
      var request = new XMLHttpRequest();
      request.open("POST", '/actions/sendCommand');
      request.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      request.onreadystatechange = function () {
            if (request.readyState === XMLHttpRequest.DONE) {
                  if (callback) callback(request.status === postActionStatus, request);
                  if (request.status === postActionStatus) {
                        // do nothing
                  } else {
                        console.error(name + ' fehlgeschlagen! Status: ' + request.status + ' ' + request.statusText);
                  }
            }
      }
      if (command) {
            request.send(command);
      }
} // postSendCommand


/**
 * Displays the values from the webSocket
 * @param {*} properties    the most recent properties
 */
function displayVal(properties) {
      var temp = properties.currTemp;
      var hum = properties.currHum;
      var dur = properties.duration;
      var light = properties.light;
      var use = properties.inUse;
      var isOnline = properties.isOnline;
      td.getElementById('currTemp').value = temp;
      td.getElementById('currHum').value = hum;
      td.getElementById('currDur').value = dur;
      td.getElementById('levelLight').value = light;
      td.getElementById('switchSauna').value = use;
      if (isOnline == true) {
            $('#isOnline').html('Online');
            td.getElementById('isOnline').style.color = '#00d300';
      } else {
            $('#isOnline').html('Offline');
            td.getElementById('isOnline').style.color = '#ff0000';
      }
} // displayVal

/**
 * Get the selected option and display it in the specific fields
 */
function getSelectedOption() {
      var selectedOption = td.getElementById('selectBtn').value;
      switch (selectedOption) {
            case 'finarium':
                  tarTemp = 90;
                  tarHum = 15;
                  tarDur = 30;
                  break;
            case 'dampfbad':
                  tarTemp = 50;
                  tarHum = 50;
                  tarDur = 30;
                  break;
            case 'warmluftbad':
                  tarTemp = 45;
                  tarHum = 15;
                  tarDur = 30;
                  break;
            default:
                  tarTemp = 42;
                  tarHum = 42;
                  tarDur = 42;
                  break;
      }
      td.getElementById('targetTemp').value = tarTemp;
      td.getElementById('targetHum').value = tarHum;
      td.getElementById('targetDur').value = tarDur;
} // getSelectedOption