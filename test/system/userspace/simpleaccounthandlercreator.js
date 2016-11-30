function createSimpleAccountHandler(execlib, BankSinkHandler) {
  'use strict';

  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib;

  function SimpleAccountHandler(sink, username) {
    BankSinkHandler.call(this, sink, username);
    this.reservation = null;
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
      this.charge.bind(this, -1000, ['fill 1000']),
      this.charge.bind(this, 10, ['take 10']),
      this.reserve.bind(this, 30, ['reserve 30']),
      this.commitReservation.bind(this, null, ['commit reserve 30']),
      this.reserve.bind(this, 50, ['reserve 50']),
      this.commitReservation.bind(this, 10, ['partially commit for 10']),
      this.withdrawAll.bind(this),
    ])).go();
  };

  SimpleAccountHandler.prototype.reserve = function (amount, reason) {
    if (this.reservation) {
      return q.reject(new lib.Error('ALREADY_HAVE_RESERVATION', 'Already have reservation'));
    }
    this.reservation = {
      reservedamount: amount,
      result: null
    };
    var p = BankSinkHandler.prototype.reserve.call(this, amount, reason);
    p.then(this.onReservation.bind(this));
    return p;
  };

  SimpleAccountHandler.prototype.onReservation = function (reservationresult) {
    this.reservation.result = reservationresult;
  };

  SimpleAccountHandler.prototype.commitReservation = function (amount, reason) {
    var reservation, result;
    if (!this.reservation) {
      return q.reject(new lib.Error('NO_RESERVATION_TO_COMMIT', 'No reservation to commit'));
    }
    reservation = this.reservation;
    result = reservation.result;
    this.reservation = null;
    if (amount) {
      console.log('current balance', this.balance, 'commit amount', amount, 'original reservation', reservation, 'expecting new balance', this.balance+(reservation.reservedamount-amount));
      return BankSinkHandler.prototype.partiallyCommitReservation.call(this, result[0], result[1], amount, reason, this.balance+(reservation.reservedamount-amount));
    } else {
      console.log('original reservation', reservation, 'expecting balance', this.balance, 'to remain unchanged');
      return BankSinkHandler.prototype.commitReservation.call(this, result[0], result[1], reason);
    }
  };

  return SimpleAccountHandler;
}

module.exports = createSimpleAccountHandler;
