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
        leveldbValueEncoding: 'Int64Codec'
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

  BankService.prototype.createStartDBPromises = function () {
    var rd = q.defer();

    this.logopts.dbcreationoptions.bufferValueEncoding = ['String', 'Int32LE'].concat(this.referenceUserNames).concat(['UInt64LE']);

    this.reservations = new (leveldblib.DBArray)({
      dbname: Path.join(this.dbdirpath, 'reservations.db'),
      dbcreationoptions: {
        valueEncoding: bufferlib.makeCodec(['String', 'UInt32LE'].concat(this.referenceUserNames).concat(['UInt64LE', 'String']), 'reservations')
      },
      starteddefer: rd,
      startfromone: true
    });
    return ParentService.prototype.createStartDBPromises.call(this).concat([rd.promise]);
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

  function chargeallowance(balance, amount) {
    //console.log('chargeallowance?', record, amount);
    if (balance >= amount) {
      //console.log('chargeallowance is ok', balance, '>', amount);
      return true;
    }
    throw new lib.Error('INSUFFICIENT_FUNDS', balance);
  }
  BankService.prototype.charge = function (username, amount, referencearry) {
    return this.locks.run(username, this.chargeJob(username, amount, referencearry));
  };
  BankService.prototype.chargeJobTasks = function (username, amount, referencearry) {
    if (!referencearry) {
      console.trace();
      console.error('no reference array');
      process.exit(0);
      return;
    }
    //console.log('charge', username, 'for', amount);
    var decoptions = {
        defaultrecord: function () {
          if (amount>0) {
            amount = null;
            throw new lib.Error('NO_USERNAME');
          }
          amount = null;
          return 0;
        },
        criterionfunction: chargeallowance
      },
      ret;
    if (!username) {
      return [q.reject(new lib.Error('NO_USERNAME'))];
    }
    if (!lib.isNumber(amount)) {
      return [q.reject(new lib.Error('AMOUNT_MUST_BE_A_NUMBER'))];
    }
    ret = [
      this.kvstorage.dec.bind(this.kvstorage, username, null, amount, decoptions),
      this.recordTransaction.bind(this, username, amount, referencearry)
    ];
    username = null;
    amount = null;
    referencearry = null;
    return ret;
  };
  BankService.prototype.chargeJob = function (username, amount, referencearry) {
    return new qlib.PromiseChainerJob(this.chargeJobTasks(username, amount, referencearry));
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
      this.kvstorage.dec.bind(this.kvstorage, username, null, amount, decoptions),
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
    var balance = result[1], rsrvarry = [username, amount].concat(referencearry);
    rsrvarry.push(Date.now());
    rsrvarry.push(secretString());
    username = null;
    amount = null;
    referencearry = null;
    result = null;
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
    var balance = result[1], tranarry = [username, -amount].concat(referencearry), ret;
    tranarry.push(Date.now());
    //console.log('result', result, 'balance', balance);
    //console.log('log <=', tranarry, '(referencearry', referencearry, ')');
    ret = this.log.push(tranarry)
      .then(transactor.bind(null, balance));
    username = null;
    amount = null;
    referencearry = null;
    return ret;
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
    if (!reservation) {
      return q.reject(new lib.Error('NO_RESERVATION'));
    }
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
    var ret = this.chargeJob(username, -cancelmoney, referencearry).go().then(
      chargeResultEnhancerWithReservationMoney.bind(null, cancelmoney)
    );
    username = null;
    cancelmoney = null;
    referencearry = null;
    return ret;
  };

  function chargeResultEnhancerWithReservationMoney (money, result) {
    return q([result[0], result[1], money]);
  }

  BankService.prototype.reset = function (username, resetreference) {
    return this.locks.run(username, this.resetJob(username, resetreference));
  };

  BankService.prototype.resetTo = function (username, newbalance, closingreference, resetreference, openingreference) {
    return this.locks.run(username, this.resetToJob(username, newbalance, closingreference, resetreference, openingreference));
  };


  BankService.prototype.resetJobTasks = function (username, resetreference) {
    var resetid = lib.uid(),
      ret = [
        this.prepareResetLog.bind(this, resetid, username),
        this.collectUserTxns.bind(this, resetid, username),
        this.writeInitialTransactionAfterReset.bind(this, username, resetreference)
      ];
    username = null;
    resetreference = null;
    return ret;
  };

  BankService.prototype.resetJob = function (username, resetreference) {
    return new qlib.PromiseChainerJob(this.resetJobTasks(username, resetreference));
  };

  function collector(collectobj, kvobj) {
    var txn = kvobj.value, txnmoment = txn[txn.length-1];
    if (txn[0] === collectobj.username) {
      collectobj.count ++;
      collectobj.delbatch.del(kvobj.key);
      collectobj.writebatch.put(kvobj.key, kvobj.value);
      if (txnmoment < collectobj.minmoment) {
        collectobj.minmoment = txnmoment;
      }
      if (txnmoment > collectobj.maxmoment) {
        collectobj.maxmoment = txnmoment;
      }
    }
  };

  BankService.prototype.prepareResetLog = function (resetid, username) {
    var d = q.defer(), ro = this.logCreateObj();
    ro.dbname = Path.join(this.dbdirpath, 'resets', resetid);
    ro.starteddefer = d;
    new leveldblib.LevelDBHandler(ro);
    return d.promise;
  };

  BankService.prototype.collectUserTxns = function (resetid, username, resetdb) {
    var collectobj = {
      id: resetid,
      db: resetdb,
      writebatch: resetdb.db.batch(),
      delbatch: this.log.db.batch(),
      username: username,
      minmoment: Infinity,
      maxmoment: -Infinity,
      count: 0
    },
     d = q.defer(),
     rr = this.recordReset.bind(this, d, collectobj),
     traverser = this.log.traverse(collector.bind(null, collectobj)),
     ender = function () {
       if (collectobj.count) {
         collectobj.delbatch.write(
           collectobj.writebatch.write.bind(
             collectobj.writebatch,
             rr
           )
         );
       } else {
         collectobj.minmoment = collectobj.maxmoment = Date.now();
         rr(true);
       }
       collectobj = null;
       rr = null;
     };

    traverser.then(
      ender,
      ender
    );
    return d.promise;
  };

  BankService.prototype.writeInitialTransactionAfterReset = function (username, resetreference) {
    return this.readAccount(username).then(
      (balance) => {
        return this.recordTransaction(username, -balance, resetreference, [0, balance]);
      }
    );
  };

  BankService.prototype.recordReset = function (defer, resetobj) {
    resetobj.db.destroy();
    qlib.promise2defer(ParentService.prototype.recordReset.call(this, resetobj.id, resetobj.username, resetobj.minmoment, resetobj.maxmoment, resetobj.count), defer);
    resetobj.id = null;
    resetobj.db = null;
    resetobj.writebatch = null;
    resetobj.delbatch = null;
    resetobj.username = null;
    resetobj.minmoment = null;
    resetobj.maxmoment = null;
    resetobj.count = null;
    defer = null;
  };

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

  require('./resettoextensioncreator')(execlib, BankService);
  
  return BankService;
}

module.exports = createBankService;
