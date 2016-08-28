function createUser(execlib, ParentUser, leveldblib) {
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib,
    execSuite = execlib.execSuite,
    HookableUserSessionMixin = leveldblib.HookableUserSessionMixin;

  if (!ParentUser) {
    ParentUser = execSuite.ServicePack.Service.prototype.userFactory.get('user');
  }

  var UserSession = ParentUser.prototype.getSessionCtor('.'),
    Channel = UserSession.Channel;

  function BankChannel (usersession){
    Channel.call(this, usersession);
  }
  lib.inherit(BankChannel, Channel);
  BankChannel.prototype.name = 'l';

  function BankSession (user, session, gate) {
    UserSession.call(this, user, session, gate);
    HookableUserSessionMixin.call(this, this.user.__service.kvstorage);
    this.addChannel(BankChannel);
  }

  UserSession.inherit(BankSession, HookableUserSessionMixin.__methodDescriptors);
  HookableUserSessionMixin.addMethods(BankSession);

  BankSession.prototype.__cleanUp = function () {
    HookableUserSessionMixin.prototype.destroy.call(this);
    UserSession.prototype.__cleanUp.call(this);
  };

  BankSession.Channel = BankChannel;


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
    //qlib.promise2defer(this.__service.kvstorage.get(username), defer);
    qlib.promise2defer(this.__service.readAccountSafe(username, [0]), defer);
  };

  User.prototype.closeAccount = function (username, defer) {
    //qlib.promise2defer(this.__service.kvstorage.get(username), defer);
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

  User.prototype.cancelReservation = function (reservationid, control, reason, defer) {
    qlib.promise2defer(this.__service.cancelReservation(reservationid, control, reason), defer);
  };

  User.prototype.traverseAccounts = function (options, defer) {
    this.streamLevelDB(this.__service.kvstorage, options, defer);
  };

  User.prototype.traverseTransactions = function (options, defer) {
    this.streamLevelDB(this.__service.log, options, defer);
  };

  User.prototype.traverseReservations = function (options, defer) {
    this.streamLevelDB(this.__service.reservations, options, defer);
  };

  User.prototype.getSessionCtor = execSuite.userSessionFactoryCreator(BankSession);

  return User;
}

module.exports = createUser;
