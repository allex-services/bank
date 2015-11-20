var child_process = require('child_process');

function createBankService(execlib, ParentServicePack, leveldb, bufferlib) {
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    ParentService = ParentServicePack.Service;

  function factoryCreator(parentFactory) {
    return {
      'service': require('./users/serviceusercreator')(execlib, parentFactory.get('service')),
      'user': require('./users/usercreator')(execlib, parentFactory.get('user')) 
    };
  }

  function BankService(prophash) {
    ParentService.call(this, prophash);
    this.accounts = null;
    this.reservations = null;
    this.transactions = null;
    child_process.exec('mkdir -p bank', this.onMkDir.bind(this));
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
        valueEncoding: bufferlib.makeCodec(['String', 'UInt32LE', 'UInt64LE'], 'reservations')
      },
      starteddefer: rd,
      startfromone: true
    });
    this.transactions = new (leveldb.DBArray)({
      dbname: 'bank/transactions.db',
      dbcreationoptions: {
        valueEncoding: bufferlib.makeCodec(['String', 'Int32LE', 'String', 'UInt64LE'], 'reservations')
      },
      starteddefer: td,
      startfromone: true
    });
  };

  function decer(amount, record) {
    console.log('record', record, 'amount', amount);
    if (!record) {
      if (amount > 0) {
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
  BankService.prototype.charge = function (username, amount) {
    return this.accounts.upsert(username, decer.bind(null, amount)).then(
      this.recordTransaction.bind(this, username, amount, 'charge')
    );
  };

  BankService.prototype.reserve = function (username, amount) {
    return this.accounts.upsert(username, decer.bind(null, amount)).then(
      this.recordReservation.bind(this, username, amount)
    );
  };

  BankService.prototype.commitReservation = function (reservationid) {
    return this.reservations.get(reservationid).then(
      this.recordTransactionFromReservation.bind(this)
    );
  };


  function reserver(reservation) {
    console.log('reservation id', reservation, '?');
    return q(reservation[0]);
  }
  BankService.prototype.recordReservation = function (username, amount) {
    return this.reservations.push([username, amount, Date.now()]).then(
      reserver
    );
  };
  
  function transactor(transaction) {
    console.log('transaction id', transaction, '?');
    return q(transaction[0]);
  }
  BankService.prototype.recordTransaction = function (username, amount, type) {
    return this.transactions.push([username, amount, type, Date.now()])
    .then(transactor);
  };
  BankService.prototype.recordTransactionFromReservation = function (reservation) {
    console.log('what should I do with', reservation, 'to recordTransactionFromReservation?');
    return this.transactions.push([reservation[0], reservation[1], 'commit:'+reservation[2],Date.now()])
    .then(transactor); 
  };
  
  return BankService;
}

module.exports = createBankService;
