var bcrypt = require('bcrypt');
var path = require('path');
var fs = require('fs');

// array for id numbers and (hashed) passwords
var records = [];
// list of predefined passwords (must not be easy ones if not for developing!)
const passwords = ['secret', '1234', 'asdf', 'test', 'qwer', 'test55', 'hallo'];

var idToFind = 0;
var usersFilePath = path.join(__dirname, 'users.json');
const hashRounds = 8;

var anUpperCase = /[A-Z]/;
var aLowerCase = /[a-z]/;
var aNumber = /[0-9]/;
var aSpecial = /[!|@|#|$|%|^|&|*|(|)|-|_]/;

loadUsers();

/**
 * Load the id's and the (hashed) passwords from the file.
 * If no file is present, use the predefined passwords
 */
function loadUsers() {
  try {
    records = fs.readFileSync(usersFilePath, 'utf8').toString();
    records = JSON.parse(records);
    console.log('loaded users from file');
  } catch (e) {
    console.log('Could not load users from file!');
    console.log(e);
    console.log('Creating a default records object');
    records = [];
    passwords.forEach(function (password, index) {
      bcrypt.hash(password, hashRounds, function (err, hash) {
        records.push({ id: (index + 1), password: hash });
        if (index == passwords.length - 1) {
          // Some passwords may take longer to hash,
          // waiting a little to make sure all passwords are done being hashed
          setTimeout(function () {
            // This function will be called after 2000 milliseconds (approximately)
            console.log(records);
            fs.writeFile(usersFilePath, JSON.stringify(records), 'utf8');
          }, 2000);
        }
      }); // bcrypt.hash
    }); // forEach
  }
} // loadUsers

/**
 * Deletes the password file (users.json) and reloads the default passwords
 */
exports.reset = function (callback) {
  fs.unlink(usersFilePath, function (err) {
    if (err) {
      console.log('failed to reset passwords');
      return callback(err);
    } else {
      console.log('reseting passwords');
      loadUsers();
      return callback();
    }
  });
} // reset

/**
 * Finds a user to the specified id and runs the callback with the found user
 */
function findById(id, callback) {
  process.nextTick(function () {
    idToFind = id;
    var record = records.find(findID);
    if (record) {
      callback(null, record);
    } else {
      callback(new Error('User ' + id + ' does not exist'));
    }
  });
} // findById

exports.findById = findById;

// Auswertungs-Funktion für array.find
function findID(record) {
  return record.id == idToFind;
}

/**
 * Checks if a password is in the list and runs the callback with the user if so
 */
exports.checkPassword = function (password, callback) {
  console.log('checking password: ' + password);
  var accessGranted = false;
  var i;
  records.forEach(function (record, index) {
    bcrypt.compare(password, record.password, function (err, res) {
      if (err) { return callback(err); }
      if (res) {
        i = index;
        accessGranted = true;
      }
      if (index == records.length - 1) { grantAccess(accessGranted, i, callback); }
    }); // bcrypt.compare
  }); // records.forEach
} // checkPassword

/**
 * Runs the callback (from checkPassword) with the user at position i in the records array
 * (i is NOT the same as the id, due to asynchronous filling of the records array in loadUsers)
 * @param {*} accessGranted true if the password matched one in the list
 * @param {*} i index from the found user in the records array, undefined if no user found
 * @param {*} callback callback from the checkPassword
 */
function grantAccess(accessGranted, i, callback) {
  if (i !== undefined && accessGranted === true) {
    return callback(null, records[i]);
  } else {
    return callback(null, null);
  }
} // grantAccess

/**
 * Check if user has entrered all things correctly and change his password if so
 */
exports.changePassword = function (id, oldPassword, newPassword, confirmPassword, callback) {
  if (newPassword !== confirmPassword) {
    console.log('confirmed password is not equal to new password');
    return callback(false, 'confirmed password is not equal to new password');
  }
  if (newPassword == '') {
    console.log('new password is empty');
    return callback(false, 'new password is empty');
  } else if (!checkPasswordRestrictions(newPassword)) {
    console.log('new password doesn\'t match the requested format');
    return callback(false, 'new password does not match the requested format');
  }
  for (var i in records) {
    if (records[i].id == id) {
      //console.log('User ' + id + ' found in list at position ' + i + ' with pw ' + records[i].password);
      bcrypt.compare(oldPassword, records[i].password, function (err, res) {
        if (err) {
          console.log(err);
          return callback(false, 'unknown error!')
        }
        if (!res) {
          console.log('old password is incorrect');
          return callback(false, 'old password is incorrect');
        } else {
          // store new password
          bcrypt.hash(newPassword, hashRounds, function (err, hash) {
            if (err) {
              console.log(err);
              return callback(false, 'unknown error!');
            }
            records[i].password = hash;
            fs.writeFile(usersFilePath, JSON.stringify(records), 'utf8');
            return callback(true, 'successfully changed password');
          }); // bcrypt.hash
        }
      }); // bcrypt.compare
      // we found our user, don't compare the rest of the users in records
      break;
    } // if
  } // for
} // changePassword

/**
 * Checks if a password is at least 8 characters long
 * and has at least one lower and one upper case letter and one number.
 * Returns false if not.
 * @param {*} password the password string to test
 */
function checkPasswordRestrictions(password) {
  //console.log('checking password restrictions of password ' + password);
  var numUpper = 0;
  var numLower = 0;
  var numNums = 0;
  var numSpecials = 0;
  if (password.length < 8) {
    // console.log('it doesnt match')
    return false;
  }
  for (var i = 0; i < password.length; i++) {
    if (anUpperCase.test(password[i]))
      numUpper++;
    else if (aLowerCase.test(password[i]))
      numLower++;
    else if (aNumber.test(password[i]))
      numNums++;
    else if (aSpecial.test(password[i]))
      numSpecials++;
  }
  // console.log('upperCase: ' + numUpper);
  // console.log('lowerCase: ' + numLower);
  // console.log('numbers: ' + numNums);
  // console.log('specials: ' + numSpecials);
  if (numUpper < 1 || numLower < 1 || numNums < 1) {
    // console.log('it doesnt match')
    return false;
  }
  // console.log('it matches!')
  return true;
} // checkPasswordRestrictions
