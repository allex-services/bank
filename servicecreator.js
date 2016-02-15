var child_process = require('child_process'),
  randomBytes = require('crypto').randomBytes,
  Path = require('path');

function createBankService(execlib, ParentServicePack, leveldblib, bufferlib) {
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib,
    ParentService = ParentServicePack.Service;

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
    ParentService.call(this, prophash);
    this.accounts = null;
    this.reservations = null;
    this.transactions = null;
    this.locks = new qlib.JobCollection();
    child_process.exec('mkdir -p '+prophash.path, this.onMkDir.bind(this, prophash.path));
  }
  
  ParentService.inherit(BankService, factoryCreator);
  
  BankService.prototype.__cleanUp = function() {
    if (this.transactions) {
      this.transactions.destroy();
    }
    this.transactions = null;
    if (this.reservations) {
      this.reservations.destroy();
    }
    this.reservations = null;
    if (this.accounts) {
      this.accounts.destroy();
    }
    this.accounts = null;
    ParentService.prototype.__cleanUp.call(this);
  };

  BankService.prototype.isInitiallyReady = function () {
    return false;
  };

  var _SECRET_STRING_INDEX = 4;
  BankService.prototype.onMkDir = function (path, error) {
    if (error) {
      this.close();
      return;
    }
    var ad = q.defer(),
      rd = q.defer(),
      td = q.defer();

    q.allSettled([ad.promise,rd.promise,td.promise]).then(
      this.onBankReady.bind(this)
    ).fail(
      this.close.bind(this)
    );
    this.accounts = leveldblib.createDBHandler({
      dbname: Path.join(path, 'accounts.db'), //'bank/accounts.db',
      dbcreationoptions: {
        valueEncoding: bufferlib.makeCodec(['UInt32LE'], 'accounts')
      },
      starteddefer: ad
    });
    this.reservations = new (leveldblib.DBArray)({
      dbname: Path.join(path, 'reservations.db'), //'bank/reservations.db',
      //dbname: 'bank/reservations.db',
      dbcreationoptions: {
        valueEncoding: bufferlib.makeCodec(['String', 'UInt32LE'].concat(this.referenceUserNames).concat(['UInt64LE', 'String']), 'reservations') //username, amount (positive), reference, timestamp, secret (for later commit)
      },
      starteddefer: rd,
      startfromone: true
    });
    this.transactions = new (leveldblib.DBArray)({
      dbname: Path.join(path, 'transactions.db'), //'bank/transactions.db',
      //dbname: 'bank/transactions.db',
      dbcreationoptions: {
        valueEncoding: bufferlib.makeCodec(['String', 'Int32LE'].concat(this.referenceUserNames).concat(['UInt64LE']), 'reservations') //username, amount (signed), reference, timestamp
      },
      starteddefer: td,
      startfromone: true
    });
  };
  BankService.prototype.onBankReady = function () {
    this.readyToAcceptUsersDefer.resolve(true);
  };

  BankService.prototype.readAccount = function (username) {
    return this.accounts.get(username);
  };

  BankService.prototype.readAccountWDefault = function (username, deflt) {
    //console.log('reading account with default', username, deflt);
    return this.accounts.getWDefault(username, deflt);
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
    //console.log('charge', username, 'for', amount);
    var decoptions = {
        defaultrecord: (amount > 0 ? null : [0]),
        criterionfunction: chargeallowance
      };
    if (!username) {
      return q.reject(new lib.Error('NO_USERNAME'));
    }
    if (!lib.isNumber(amount)) {
      return q.reject(new lib.Error('AMOUNT_MUST_BE_A_NUMBER'));
    }
    return this.locks.run(username, new qlib.PromiseChainerJob([
      this.accounts.dec.bind(this.accounts, username, 0, amount, decoptions),
      this.recordTransaction.bind(this, username, amount, referencearry)
    ]));
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
      this.accounts.dec.bind(this.accounts, username, 0, amount, decoptions),
      this.recordReservation.bind(this, username, amount, referencearry)
    ]));
  };

  BankService.prototype.commitReservation = function (reservationid, controlcode) {
    //console.log('commitReservation', reservationid, controlcode);
    if (!(lib.isNumber(reservationid) && reservationid>0)) {
      return q.reject(new lib.Error('RESERVATIONID_MUST_BE_A_POSITIVE_NUMBER'));
    }
    if (!(controlcode && lib.isString(controlcode))) {
      return q.reject(new lib.Error('CONTROL_CODE_MUST_BE_A_STRING'));
    }
    var pc = new qlib.PromiseChainerJob([
      this.reservations.get.bind(this.reservations, reservationid),
      this.recordTransactionFromReservation.bind(this, controlcode)
    ]),
      pcp = pc.defer.promise;
    pc.go();
    return pcp;
  };


  function reserver(balance, reservation) {
    //console.log('reservation id', reservation, '?');
    return q([reservation[0], reservation[1][_SECRET_STRING_INDEX], balance]);
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
    return q([transaction[0], balance]);
  }
  BankService.prototype.recordTransaction = function (username, amount, referencearry, result) {
    var balance = result[1][0], tranarry = [username, amount].concat(referencearry);
    tranarry.push(Date.now());
    //console.log('result', result, 'balance', balance);
    //console.log('transactions <=', tranarry, '(referencearry', referencearry, ')');
    return this.transactions.push(tranarry)
      .then(transactor.bind(null, balance));
  };
  BankService.prototype.recordTransactionFromReservation = function (controlcode, reservation) {
    //console.log('what should I do with', arguments, 'to recordTransactionFromReservation?');
    if (controlcode !== reservation[_SECRET_STRING_INDEX]) {
      return q.reject(new lib.Error('WRONG_CONTROL_CODE', controlcode));
    }
    return this.transactions.push([reservation[0], reservation[1], reservation[2], Date.now()])
    .then(transactor.bind(null,0)); 
  };

  BankService.prototype.dumpToConsole = function (options) {
    console.log('accounts');
    return this.accounts.dumpToConsole(options).then(
      qlib.executor(console.log.bind(console, 'transactions'))
    ).then(
      qlib.executor(this.transactions.dumpToConsole.bind(this.transactions, options))
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
