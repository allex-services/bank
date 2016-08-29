function createTxnTester (execlib, leveldblib) {
  'use strict';

  var lib = execlib.lib,
    q = lib.q;

  function TxnTester(users) {
    this.users = users;
    this.map = new lib.Map();
  }
  TxnTester.prototype.destroy = function () {
    this.users = null;
  };
  function resolver(d) {
    d.resolve(true);
  }
  TxnTester.prototype.go = function (sink) {
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
      balance = this.map.get(user);
    if (!balance) {
      balance = 0;
    }
    this.map.replace(user, balance-amount);
  };
  function zerochecker (balance, user) {
    if (balance !== 0) {
      console.error('user', user, 'has non-zero balance', balance);
      throw Error('user '+ user+ ' has non-zero balance '+ balance);
    }
  }
  TxnTester.prototype.onDone = function (countobj) {
    try {
      this.map.traverse(zerochecker);
      return q(countobj.count);
    } catch (e) {
      return q.reject(e);
    }
  };

  return TxnTester;
}

module.exports = createTxnTester;
