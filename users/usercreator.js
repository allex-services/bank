function createUser(execlib, ParentUser) {
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib;

  if (!ParentUser) {
    ParentUser = execlib.execSuite.ServicePack.Service.prototype.userFactory.get('user');
  }

  function User(prophash) {
    ParentUser.call(this, prophash);
  }
  
  ParentUser.inherit(User, require('../methoddescriptors/user'), [/*visible state fields here*/]/*or a ctor for StateStream filter*/);
  User.prototype.__cleanUp = function () {
    ParentUser.prototype.__cleanUp.call(this);
  };

  User.prototype.readAccount = function (username, defer) {
    qlib.promise2defer(this.__service.accounts.get(username), defer);
  };

  User.prototype.charge = function (username, amount, reason, defer) {
    qlib.promise2defer(this.__service.charge(username, amount, reason), defer);
  };

  User.prototype.reserve = function (username, amount, reason, defer) {
    qlib.promise2defer(this.__service.reserve(username, amount, reason), defer);
  };

  User.prototype.commitReservation = function (reservationid, control, defer) {
    qlib.promise2defer(this.__service.commitReservation(reservationid, control), defer);
  };

  return User;
}

module.exports = createUser;
