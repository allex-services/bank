function createBankSinkHandler (execlib) {
  'use strict';

  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib;

  function BankSinkHandler (sink, username) {
    this.sink = null;
    this.sinkDestroyedHandler = null;
    this.username = username;
    this.balance = null;
    if (!sink.destroyed) {
      return;
    }
    this.sink = sink;
    this.sinkDestroyedHandler = sink.destroyed.attach(this.destroy.bind(this));
  }

  BankSinkHandler.prototype.destroy = function () {
    this.balance = null;
    this.username = null;
    if (this.sinkDestroyedHandler) {
      this.sinkDestroyedHandler.destroy();
    }
    this.sinkDestroyedHandler = null;
    this.sink = null;
  };

  BankSinkHandler.prototype.expect = function (commandwparams, exp) {
    var _t, _d, d, _q, _error, _eq, _cl, _ce, _isarr;
    if (!this.sink) {
      return;
    }
    d = q.defer();
    _t = this;
    _d = d;
    _q = q;
    _error = lib.Error;
    _eq = lib.isEqual;
    _cl = console.log.bind(console);
    _ce = console.error.bind(console);
    _isarr = lib.isArray;
    function localcleanup () {
      exp = null;
      _t = null;
      _d = null;
      _q = null;
      _error = null;
      _eq = null;
      _cl = null;
      _ce = null;
      _isarr = null;
    }
    this.sink.call.apply(this.sink, commandwparams).then(
      function (result) {
        var mismatch = false, i, e;
        if (_isarr(exp)) {
          for(i = 0; i<exp.length && !mismatch; i++) {
            e = exp[i];
            if (e.hasOwnProperty('value')) {
              mismatch = result[e.index] !== e.value;
            }
            if (e.hasOwnProperty('balance_delta')) {
              mismatch = result[e.index] !== _t.balance + e.balance_delta;
              if (!mismatch) {
                _t.balance += e.balance_delta;
              }
            }
          }
        }
        if (mismatch) {
          _ce('mismatch, got', result, ', expected', exp);
          _d.reject (new _error('MISMATCH'));
        } else {
          d.resolve(result);
        }
        localcleanup();
        localcleanup = null;
      },
      function (error) {
        _ce('error from Bank', error);
        _d.reject(error);
        localcleanup();
        localcleanup = null;
      },
      function (progress) {
        _cl('progress from Bank', progress);
      }
    );
    return d.promise;
  };

  BankSinkHandler.prototype.futureExpect = function (commandwparams, exp) {
    return this.expect.bind(this, commandwparams, exp);
  };

  BankSinkHandler.prototype.storeBalance = function (result) {
    this.balance = result[0];
    return q(result);
  };

  BankSinkHandler.prototype.readSelfAccount = function () {
    return (new qlib.PromiseChainerJob([
      this.futureExpect(['readAccount', this.username], null),
      this.storeBalance.bind(this)
    ])).go();
  };

  BankSinkHandler.prototype.charge = function (amount, reason) {
    return this.expect(['charge', this.username, amount, reason], [{index:1, balance_delta: -amount}]);
  };

  BankSinkHandler.prototype.withdrawAll = function () {
    return this.charge(this.balance, ['withdraw all']);
  };


  return BankSinkHandler;
}

module.exports = createBankSinkHandler;
