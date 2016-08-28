var randomBytes = require('crypto').randomBytes,
  Path = require('path');

  Error.stackTraceLimit = 100;

function createBankService(execlib, ParentService, leveldblib, bufferlib) {
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib;

  function secretString () {
    return randomBytes(4).toString('hex');
  }

  function factoryCreator(parentFactory) {
    return {
      'service': require('./users/serviceusercreator')(execlib, parentFactory.get('service')),
      'user': require('./users/usercreator')(execlib, parentFactory.get('user'), leveldblib) 
    };
  }

  function BankService(prophash) {
    prophash.kvstorage = {
      dbname: 'accounts.db',
      dbcreationoptions: {
        bufferValueEncoding: ['UInt32LE']
      }
    };
    prophash.log = {
      dbname: 'transactions.db',
      dbcreationoptions: {
      }
    };
    this.reservations = null;
    ParentService.call(this, prophash);
  }
  
  ParentService.inherit(BankService, factoryCreator);
  
  BankService.prototype.__cleanUp = function() {
    ParentService.prototype.__cleanUp.call(this);
    if (this.reservations) {
      this.reservations.destroy();
    }
    this.reservations = null;
  };

  BankService.prototype.createStartDBPromises = function (path) {
    var rd = q.defer();

    this.logopts.dbcreationoptions.bufferValueEncoding = ['String', 'Int32LE'].concat(this.referenceUserNames).concat(['UInt64LE']);

    this.reservations = new (leveldblib.DBArray)({
      dbname: Path.join(path, 'reservations.db'),
      dbcreationoptions: {
        valueEncoding: bufferlib.makeCodec(['String', 'UInt32LE'].concat(this.referenceUserNames).concat(['UInt64LE', 'String']), 'reservations')
      },
      starteddefer: rd,
      startfromone: true
    });
    return ParentService.prototype.createStartDBPromises.call(this, path).concat([rd.promise]);
  };

  BankService.prototype.readAccount = function (username) {
    return this.get(username);
  };

  BankService.prototype.readAccountWDefault = function (username, deflt) {
    //console.log('reading account with default', username, deflt);
    return this.getWDefault(username, deflt);
  };

  BankService.prototype.readAccountSafe = function (username, deflt) {
    //console.log('reading account with default', username, deflt);
    return this.safeGet(username, deflt);
  };

  BankService.prototype.closeAccount = function (username) {
    return this.del(username);
  };

  function chargeallowance(record, amount) {
    //console.log('chargeallowance?', record, amount);
    if (record && record[0] >= amount) {
      //console.log('chargeallowance is ok', record[0], '>', amount);
      return true;
    }
    throw new lib.Error('INSUFFICIENT_FUNDS', record[0]);
  }
  BankService.prototype.charge = function (username, amount, referencearry) {
    return this.locks.run(username, this.chargeJob(username, amount, referencearry));
  };
  BankService.prototype.chargeJob = function (username, amount, referencearry) {
    //console.log('charge', username, 'for', amount);
    var decoptions = {
        defaultrecord: function () {
          if (amount>0) {
            amount = null;
            throw new lib.Error('NO_USERNAME');
          }
          amount = null;
          return [0];
        },
        criterionfunction: chargeallowance
      };
    if (!username) {
      return q.reject(new lib.Error('NO_USERNAME'));
    }
    if (!lib.isNumber(amount)) {
      return q.reject(new lib.Error('AMOUNT_MUST_BE_A_NUMBER'));
    }
    return new qlib.PromiseChainerJob([
      this.kvstorage.dec.bind(this.kvstorage, username, 0, amount, decoptions),
      this.recordTransaction.bind(this, username, amount, referencearry)
    ]);
  };

  BankService.prototype.reserve = function (username, amount, referencearry) {
    if (!username) {
      return q.reject(new lib.Error('NO_USERNAME'));
    }
    if (!lib.isNumber(amount)) {
      return q.reject(new lib.Error('AMOUNT_MUST_BE_A_NUMBER'));
    }
    var decoptions = {
      defaultrecord: function () {throw new lib.Error('NO_ACCOUNT_YET');},
      criterionfunction: chargeallowance
    };
    return this.locks.run(username, new qlib.PromiseChainerJob([
      this.kvstorage.dec.bind(this.kvstorage, username, 0, amount, decoptions),
      this.recordReservation.bind(this, username, amount, referencearry)
    ]));
  };

  BankService.prototype.commitReservation = function (reservationid, controlcode, referencearry) {
    //console.log('commitReservation', reservationid, controlcode);
    if (!(lib.isNumber(reservationid) && reservationid>0)) {
      return q.reject(new lib.Error('RESERVATIONID_MUST_BE_A_POSITIVE_NUMBER'));
    }
    if (!(controlcode && lib.isString(controlcode))) {
      return q.reject(new lib.Error('CONTROL_CODE_MUST_BE_A_STRING'));
    }
    var pc = new qlib.PromiseChainerJob([
      this.reservations.get.bind(this.reservations, reservationid),
      this.voidOutReservationForCommit.bind(this, reservationid, controlcode, referencearry)
    ]),
      pcp = pc.defer.promise;
    pc.go();
    return pcp;
  };

  BankService.prototype.cancelReservation = function (reservationid, controlcode, referencearry) {
    //console.log('cancelReservation', reservationid, controlcode);
    if (!(lib.isNumber(reservationid) && reservationid>0)) {
      return q.reject(new lib.Error('RESERVATIONID_MUST_BE_A_POSITIVE_NUMBER'));
    }
    if (!(controlcode && lib.isString(controlcode))) {
      return q.reject(new lib.Error('CONTROL_CODE_MUST_BE_A_STRING'));
    }
    var pc = new qlib.PromiseChainerJob([
      this.reservations.get.bind(this.reservations, reservationid),
      this.voidOutReservationForCancel.bind(this, reservationid, controlcode, referencearry)
    ]),
      pcp = pc.defer.promise;
    pc.go();
    return pcp;
  };


  function reserver(balance, reservation) {
    //console.log('reservation id', reservation, reservation[1], '?');
    return q([reservation[0], reservation[1][reservation[1].length-1], balance]);
  }
  BankService.prototype.recordReservation = function (username, amount, referencearry, result) {
    //console.log('recording reservation', username, amount, referencearry, result);
    var balance = result[1][0], rsrvarry = [username, amount].concat(referencearry);
    rsrvarry.push(Date.now());
    rsrvarry.push(secretString());
    return this.reservations.push(rsrvarry).then(
      reserver.bind(null, balance)
    );
  };
  
  function transactor(balance, transaction) {
    //console.log('transaction id', transaction, '?');
    var ret = q([transaction[0], balance]);
    return ret;
  }
  BankService.prototype.recordTransaction = function (username, amount, referencearry, result) {
    var balance = result[1][0], tranarry = [username, amount].concat(referencearry);
    tranarry.push(Date.now());
    //console.log('result', result, 'balance', balance);
    //console.log('log <=', tranarry, '(referencearry', referencearry, ')');
    return this.log.push(tranarry)
      .then(transactor.bind(null, balance));
  };
  BankService.prototype.voidOutReservationForCommit = function (reservationid, controlcode, referencearry, reservation) {
    var tranarry;
    //console.log('what should I do with', arguments, 'to voidOutReservationForCommit?');
    if (controlcode !== reservation[reservation.length-1]) {
      console.error('wrong control code, controlcode', controlcode, 'against', reservation);
      return q.reject(new lib.Error('WRONG_CONTROL_CODE', controlcode));
    }
    var username = reservation[0], commitmoney = reservation[1], voidreservation;
    if (!username) {
      return q.reject(new lib.Error('NO_USERNAME_IN_RESERVATION'));
    }
    voidreservation = reservation.slice();
    voidreservation[0] = '';
    voidreservation[1] = 0;
    return this.reservations.put(reservationid, voidreservation).then(
      this.onReservationVoidForCommit.bind(this, username, commitmoney, referencearry)
    );
  };
  BankService.prototype.onReservationVoidForCommit = function (username, commitmoney, referencearry) {
    //charge 
    return this.chargeJob(username, 0, referencearry).go().then(
      chargeResultEnhancerWithReservationMoney.bind(null, commitmoney)
    );
  };

  BankService.prototype.voidOutReservationForCancel = function (reservationid, controlcode, referencearry, reservation) {
    if (controlcode !== reservation[reservation.length-1]) {
      console.error('wrong control code, controlcode', controlcode, 'against', reservation);
      return q.reject(new lib.Error('WRONG_CONTROL_CODE', controlcode));
    }
    var username = reservation[0], cancelmoney = reservation[1], voidreservation;
    if (!username) {
      return q.reject(new lib.Error('NO_USERNAME_IN_RESERVATION'));
    }
    voidreservation = reservation.slice();
    voidreservation[0] = '';
    voidreservation[1] = 0;
    return this.reservations.put(reservationid, voidreservation).then(
      this.onReservationVoidForCancellation.bind(this, username, cancelmoney, referencearry)
    );
  };
  BankService.prototype.onReservationVoidForCancellation = function (username, cancelmoney, referencearry) {
    //charge 
    return this.chargeJob(username, -cancelmoney, referencearry).go().then(
      chargeResultEnhancerWithReservationMoney.bind(null, cancelmoney)
    );
  };

  function chargeResultEnhancerWithReservationMoney (money, result) {
    return q([result[0], result[1], money]);
  }

  BankService.prototype.dumpToConsole = function (options) {
    console.log('accounts');
    return this.kvstorage.dumpToConsole(options).then(
      qlib.executor(console.log.bind(console, 'transactions'))
    ).then(
      qlib.executor(this.log.dumpToConsole.bind(this.log, options))
    );
  };

  BankService.prototype.referenceUserNames = ['String'];

  BankService.prototype.propertyHashDescriptor = {
    path: {
      type: 'string'
    }
  };
  
  return BankService;
}

module.exports = createBankService;
