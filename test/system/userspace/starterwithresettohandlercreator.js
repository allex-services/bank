function createStarterWithResetToHandler(execlib, BankSinkHandler) {
  'use strict';

  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib;

  function StarterWithResetToHandler(sink, username) {
    BankSinkHandler.call(this, sink, username);
  }
  lib.inherit(StarterWithResetToHandler, BankSinkHandler);

  StarterWithResetToHandler.prototype.destroy = function () {
    BankSinkHandler.prototype.destroy.call(this);
  };

  StarterWithResetToHandler.prototype.go = function() {
    if (!this.username) {
      return q.reject(new lib.Error('NO_USERNAME'));
    }
    return (new qlib.PromiseChainerJob([
      this.readSelfAccount.bind(this),
      this.resetTo.bind(this, 1000, ['close'], ['reset'], ['open']),
      this.charge.bind(this, 10, ['after resetTo']),
      this.withdrawAll.bind(this),
    ])).go();
  };

  return StarterWithResetToHandler;
}

module.exports = createStarterWithResetToHandler;
