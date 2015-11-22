var child_process = require('child_process'),
  randomBytes = require('crypto').randomBytes;

function createBankService(execlib, ParentServicePack, leveldb, bufferlib) {
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    ParentService = ParentServicePack.Service;

  function secretString () {
    return randomBytes(4).toString('hex');
  }

  function factoryCreator(parentFactory) {
    return {
      'service': require('./users/serviceusercreator')(execlib, parentFactory.get('service')),
      'user': require('./users/usercreator')(execlib, parentFactory.get('user')) 
    };
  }

  function BankService(prophash) {
    try {
    ParentService.call(this, prophash);
    this.accounts = null;
    this.reservations = null;
    this.transactions = null;
    child_process.exec('mkdir -p bank', this.onMkDir.bind(this));
    console.log('new BankService');
    } catch(e) {
      console.error(e.stack);
      console.error(e);
    }
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
  BankService.prototype.onMkDir = function (error) {
    if (error) {
      this.close();
      return;
    }
    var ad = q.defer(),
      rd = q.defer(),
      td = q.defer();

    q.allSettled([ad.promise,rd.promise,td.promise]).then(
      this.readyToAcceptUsersDefer.resolve.bind(this.readyToAcceptUsersDefer, true)
    ).fail(
      this.close.bind(this)
    );
    this.accounts = leveldb.createDBHandler({
      dbname: 'bank/accounts.db',
      dbcreationoptions: {
        valueEncoding: bufferlib.makeCodec(['UInt32LE'], 'accounts')
      },
      starteddefer: ad
    });
    this.reservations = new (leveldb.DBArray)({
      dbname: 'bank/reservations.db',
      dbcreationoptions: {
        valueEncoding: bufferlib.makeCodec(['String', 'UInt32LE', 'String', 'UInt64LE', 'String'], 'reservations') //username, amount (positive), reason, timestamp, secret (for later commit)
      },
      starteddefer: rd,
      startfromone: true
    });
    this.transactions = new (leveldb.DBArray)({
      dbname: 'bank/transactions.db',
      dbcreationoptions: {
        valueEncoding: bufferlib.makeCodec(['String', 'Int32LE', 'String', 'UInt64LE'], 'reservations') //username, amount (signed), reason, timestamp
      },
      starteddefer: td,
      startfromone: true
    });
  };

  function decer(amount, record) {
    console.log('record', record, 'amount', amount);
    if (!record) {
      if (amount > 0) {
        console.log('should I throw?');
        throw new lib.Error('INSUFFICIENT_FUNDS', null);
      } else {
        console.log('returning', [-amount]);
        return [-amount];
      }
    }
    if (amount > record[0]) {
      throw new lib.Error('INSUFFICIENT_FUNDS', null);
    }
    return [record[0] - amount];
  }
  function chargeallowance(record, amount) {
    console.log('chargeallowance?', record, amount);
    if (record && record[0] > amount) {
      console.log('chargeallowance is ok', record[0], '>', amount);
      return true;
    }
    throw new lib.Error('INSUFFICIENT_FUNDS', record[0]);
  }
  BankService.prototype.charge = function (username, amount, reason) {
    //return this.accounts.upsert(username, decer.bind(null, amount)).then(
    console.log('charge', username, 'for', amount);
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
    if (!(reason && lib.isString(reason))) {
      return q.reject(new lib.Error('REASON_MUST_BE_A_STRING'));
    }
    return this.accounts.dec(username, 0, amount, decoptions).then(
      this.recordTransaction.bind(this, username, amount, reason)
    );
  };

  BankService.prototype.reserve = function (username, amount, reason) {
    if (!username) {
      return q.reject(new lib.Error('NO_USERNAME'));
    }
    if (!lib.isNumber(amount)) {
      return q.reject(new lib.Error('AMOUNT_MUST_BE_A_NUMBER'));
    }
    if (!(reason && lib.isString(reason))) {
      return q.reject(new lib.Error('REASON_MUST_BE_A_STRING'));
    }
    var decoptions = {
      defaultrecord: function () {throw new lib.Error('NO_ACCOUNT_YET');},
      criterionfunction: chargeallowance
    };
    return this.accounts.dec(username, 0, amount, decoptions).then(
      this.recordReservation.bind(this, username, amount, reason)
    );
  };

  BankService.prototype.commitReservation = function (reservationid, controlcode) {
    if (!(lib.isNumber(reservationid) && reservationid>0)) {
      return q.reject(new lib.Error('RESERVATIONID_MUST_BE_A_POSITIVE_NUMBER'));
    }
    if (!(controlcode && lib.isString(controlcode))) {
      return q.reject(new lib.Error('CONTROL_CODE_MUST_BE_A_STRING'));
    }
    return this.reservations.get(reservationid).then(
      this.recordTransactionFromReservation.bind(this, controlcode)
    );
  };


  function reserver(reservation) {
    //console.log('reservation id', reservation, '?');
    return q([reservation[0], reservation[1][_SECRET_STRING_INDEX]]);
  }
  BankService.prototype.recordReservation = function (username, amount, reason, result) {
    console.log('recording reservation', username, amount, reason, result);
    return this.reservations.push([username, amount, reason, Date.now(), secretString()]).then(
      reserver
    );
  };
  
  function transactor(transaction) {
    console.log('transaction id', transaction, '?');
    return q(transaction[0]);
  }
  BankService.prototype.recordTransaction = function (username, amount, reason) {
    return this.transactions.push([username, amount, reason, Date.now()])
    .then(transactor);
  };
  BankService.prototype.recordTransactionFromReservation = function (controlcode, reservation) {
    console.log('what should I do with', arguments, 'to recordTransactionFromReservation?');
    if (controlcode !== reservation[_SECRET_STRING_INDEX]) {
      return q.reject(new lib.Error('WRONG_CONTROL_CODE', controlcode));
    }
    return this.transactions.push([reservation[0], reservation[1], reservation[2], Date.now()])
    .then(transactor); 
  };
  
  return BankService;
}

module.exports = createBankService;
