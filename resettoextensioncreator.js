function extendBankForResetTo (execlib, BankService) {
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib;

  BankService.prototype.resetToJob = function (username, newbalance, closingreference, resetreference, openingreference) {
    return new qlib.PromiseChainerJob(this.resetToJobTasks(username, newbalance, closingreference, resetreference, openingreference));
  };

  BankService.prototype.resetToJobTasks = function (username, newbalance, closingreference, resetreference, openingreference) {
    return [
      this.readAccountSafe.bind(this, username, 'NOT_FOUND'),
      this.onAccountForResetTo.bind(this, username, newbalance, closingreference, resetreference, openingreference)
    ];
  };

  BankService.prototype.onAccountForResetTo = function (username, newbalance, closingreference, resetreference, openingreference, balance) {
    var promiseproviders, ret;
    if (!lib.isNumber(balance)) {
      ret = this.chargeJob(username, -newbalance, openingreference).go();
    } else {
      promiseproviders = [];
      if (balance) {
        promiseproviders.push(this.emptyAccountForResetTo.bind(this, username, balance, closingreference));
      }
      promiseproviders.push.apply(promiseproviders, this.resetJobTasks(username, resetreference));
      promiseproviders.push.apply(promiseproviders, this.chargeJobTasks(username, -newbalance, openingreference));
      ret = new qlib.PromiseChainerJob(promiseproviders).go();
    }
    username = null;
    newbalance = null;
    closingreference = null;
    resetreference = null;
    openingreference = null;
    return ret;
  };

  BankService.prototype.emptyAccountForResetTo = function (username, balance, closingreference) {
    var ret = (this.chargeJob(username, balance, closingreference)).go();
    username = null;
    balance = null;
    closingreference = null;
    return ret;
  };


};

module.exports = extendBankForResetTo;
