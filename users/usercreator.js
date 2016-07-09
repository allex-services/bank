function createUser(execlib, ParentUser, leveldblib) {
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib;

  if (!ParentUser) {
    ParentUser = execlib.execSuite.ServicePack.Service.prototype.userFactory.get('user');
  }

  function User(prophash) {
    ParentUser.call(this, prophash);
    leveldblib.ServiceUserMixin.call(this);
  }
  
  ParentUser.inherit(User, require('../methoddescriptors/user'), [/*visible state fields here*/]/*or a ctor for StateStream filter*/);
  leveldblib.ServiceUserMixin.addMethods(User);
  User.prototype.__cleanUp = function () {
    leveldblib.ServiceUserMixin.prototype.__cleanUp.call(this);
    ParentUser.prototype.__cleanUp.call(this);
  };

  User.prototype.readAccount = function (username, defer) {
    //qlib.promise2defer(this.__service.accounts.get(username), defer);
    qlib.promise2defer(this.__service.readAccount(username), defer);
  };

  User.prototype.closeAccount = function (username, defer) {
    //qlib.promise2defer(this.__service.accounts.get(username), defer);
    qlib.promise2defer(this.__service.closeAccount(username), defer);
  };

  User.prototype.charge = function (username, amount, reason, defer) {
    qlib.promise2defer(this.__service.charge(username, amount, reason), defer);
  };

  User.prototype.reserve = function (username, amount, reason, defer) {
    qlib.promise2defer(this.__service.reserve(username, amount, reason), defer);
  };

  User.prototype.commitReservation = function (reservationid, control, reason, defer) {
    qlib.promise2defer(this.__service.commitReservation(reservationid, control, reason), defer);
  };

  User.prototype.cancelReservation = function (reservationid, control, defer) {
    qlib.promise2defer(this.__service.cancelReservation(reservationid, control), defer);
  };

  User.prototype.traverseAccounts = function (options, defer) {
    console.log('traverseAccounts', options);
    this.streamLevelDB(this.__service.accounts, options, defer);
  };

  User.prototype.traverseTransactions = function (options, defer) {
    this.streamLevelDB(this.__service.transactions, options, defer);
  };

  User.prototype.traverseReservations = function (options, defer) {
    this.streamLevelDB(this.__service.reservations, options, defer);
  };

  return User;
}

module.exports = createUser;
