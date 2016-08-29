function createSimpleAccountHandler(execlib, BankSinkHandler) {
  'use strict';

  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib;

  function SimpleAccountHandler(sink, username) {
    BankSinkHandler.call(this, sink, username);
  }
  lib.inherit(SimpleAccountHandler, BankSinkHandler);

  SimpleAccountHandler.prototype.destroy = function () {
    BankSinkHandler.prototype.destroy.call(this);
  };

  SimpleAccountHandler.prototype.go = function() {
    if (!this.username) {
      return q.reject(new lib.Error('NO_USERNAME'));
    }
    return (new qlib.PromiseChainerJob([
      this.readSelfAccount.bind(this),
      this.charge.bind(this, -1000, ['step 1']),
      this.charge.bind(this, 10, ['step 2']),
      this.withdrawAll.bind(this),
    ])).go();
  };

  return SimpleAccountHandler;
}

module.exports = createSimpleAccountHandler;
