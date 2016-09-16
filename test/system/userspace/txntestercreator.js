function createTxnTester (execlib, leveldblib) {
  'use strict';

  var lib = execlib.lib,
    q = lib.q;

  function TxnTester(users) {
    this.users = users;
    this.balances = new lib.Map();
    this.checks = new lib.Map();
  }
  TxnTester.prototype.destroy = function () {
    if (this.checks) {
      this.checks.destroy();
    }
    this.checks = null;
    if (this.balances) {
      this.balances.destroy();
    }
    this.balances = null;
    this.users = null;
  };
  TxnTester.prototype.log = function () {
    return;
    //console.log.apply(console, arguments);
  };
  function resolver(d) {
    d.resolve(true);
  }
  TxnTester.prototype.go = function (sink) {
    return q.all(this.users.map(this.accountReader.bind(this, sink))).then(
      this.onAccountsReady.bind(this, sink)
    );
  };
  TxnTester.prototype.accountReader = function (sink, username) {
    var ret = sink.call('readAccount', username).then(
      (balance) => {
        this.balances.add(username, balance);
        this.log('read out balance', balance, 'for', username);
        username = null;
        return q(true);
      }
    );
    sink = null;
    return ret;
  };
  TxnTester.prototype.onAccountsReady = function (sink) {
    return leveldblib.streamInSink(sink,
      'traverseTransactions',
      {pagesize: 10},
      this.onTxn.bind(this),
      resolver
    ).then(
      this.onDone.bind(this),
      console.error.bind(console, 'error')
    );
  };
  TxnTester.prototype.onTxn = function (txnobj) {
    var txn = txnobj.value,
      user = txn[0],
      amount = txn[1],
      balance = this.checks.get(user);
    if (!balance) {
      balance = 0;
    }
    if (user==='auser')
    this.log('replacing', balance, '=>', balance+amount, 'for', user, 'because', amount, 'from', txnobj);
    this.checks.replace(user, balance+amount);
  };
  function zerochecker (balance, user) {
  }
  TxnTester.prototype.onDone = function (countobj) {
    try {
      this.checks.traverse((balance, user) => {
        if (balance !== this.balances.get(user)) {
          this.log('user', user, 'has balance mismatch', balance, '!==', this.balances.get(user));
          throw Error('user '+ user+ ' has balance mismatch '+ balance);
        }
      });
      return q(countobj.count);
    } catch (e) {
      return q.reject(e);
    }
  };

  return TxnTester;
}

module.exports = createTxnTester;
