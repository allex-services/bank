function createUser(execlib, ParentUser, leveldblib) {
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib,
    execSuite = execlib.execSuite;

  if (!ParentUser) {
    ParentUser = execSuite.ServicePack.Service.prototype.userFactory.get('user');
  }

  var UserSession = ParentUser.prototype.getSessionCtor('.'),
    Channel = UserSession.Channel;

  function BankChannel (usersession){
    Channel.call(this, usersession);
  }
  lib.inherit(BankChannel, Channel);
  BankChannel.prototype.name = 'b';

  function BankSession (user, session, gate) {
    UserSession.call(this, user, session, gate);
    this.addChannel(BankChannel);
    this.accountnames = null;
    this.accountListener = null;
  }

  UserSession.inherit(BankSession, {
    unhook: [{
      title: 'Unhook',
      type: 'array',
      items: {
        'type': 'string'
      },
      required: false
    }],
    hook : [{
      title: 'Hook',
      type: 'object',
      properties : {
        scan : {
          type : 'boolean',
        },
        accounts : {
          type : 'array',
          items : {
            type : 'string'
          }
        }
      },
      required: ['accounts'],
      additionalProperties : false
    }]
  });

  BankSession.prototype.__cleanUp = function () {
    this.accountnames = null;
    if (this.accountListener) {
      this.accountListener.destroy();
    }
    this.accountListener = null;
    UserSession.prototype.__cleanUp.call(this);
  };

  BankSession.ALL_KEYS = '***';

  BankSession.prototype.hook = function (hookobj, defer) {
    var doscan = hookobj.scan, accountnames = hookobj.accounts, checkforlistener = false, d;
    if (!lib.isArray(accountnames)) {
      defer.resolve(true);
    }
    if (accountnames.indexOf(BankSession.ALL_KEYS) >= 0) {
      this.accountnames = true;
      checkforlistener = true;
    } else {
      this.accountnames = this.accountnames || [];
      lib.arryOperations.appendNonExistingItems(this.accountnames, accountnames);
      checkforlistener = this.accountnames.length;
    }
    if (checkforlistener) {
      if (doscan) {
        d = q.defer();
        d.promise.then(
          this.postScan.bind(this, defer, checkforlistener),
          this.postScan.bind(this, defer, checkforlistener),
          this.onScan.bind(this));
        this.user.traverseAccounts({}, d);
      }
    }
  };

  BankSession.prototype.onScan = function (accounthash) {
    this.onAccountChanged(accounthash.key, accounthash.value[0]);
  };

  BankSession.prototype.postScan = function (defer, checkforlistener) {
    if (checkforlistener) {
      if ( !this.accountListener) {
        this.accountListener = this.user.__service.accountChanged.attach(this.onAccountChanged.bind(this));
      }
    } else {
      this.stopListening();
    }
    defer.resolve(true);
  };

  BankSession.prototype._unhook = function (accountname){
    var ind;
    if (!this.accountnames) {
      return;
    }
    if (this.accountnames === true) {
      if (accountname === BankSession.ALL_KEYS) {
        this.stopListening();
      }
      return;
    }
    ind = this.accountnames.indexOf(accountname);
    if (ind >= 0) {
      this.accountnames.splice(ind, 1);
    }
  };

  BankSession.prototype.unhook = function (accountnames, defer) {
    if (!lib.isArray(accountnames)) {
      this.stopListening();
      defer.resolve(true);
      return;
    }
    accountnames.forEach (this._unhook.bind(this));
    if (!this.accountnames) {
      this.stopListening();
    }
    defer.resolve('ok');
  };

  BankSession.prototype.stopListening = function () {
    if (this.accountListener) {
      this.accountListener.destroy();
    }
    this.accountListener = null;
    this.accountnames = null;
  };

  BankSession.prototype.onAccountChanged = function (username, balance) {
    this.sendOOB('b',[username, balance]);
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
    //qlib.promise2defer(this.__service.accounts.get(username), defer);
    qlib.promise2defer(this.__service.readAccountSafe(username, [0]), defer);
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

  User.prototype.cancelReservation = function (reservationid, control, reason, defer) {
    qlib.promise2defer(this.__service.cancelReservation(reservationid, control, reason), defer);
  };

  User.prototype.traverseAccounts = function (options, defer) {
    this.streamLevelDB(this.__service.accounts, options, defer);
  };

  User.prototype.traverseTransactions = function (options, defer) {
    this.streamLevelDB(this.__service.transactions, options, defer);
  };

  User.prototype.traverseReservations = function (options, defer) {
    this.streamLevelDB(this.__service.reservations, options, defer);
  };

  User.prototype.getSessionCtor = execSuite.userSessionFactoryCreator(BankSession);

  return User;
}

module.exports = createUser;
