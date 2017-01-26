describe('Testing hook', function () {
  findSinkIt({
    sinkname: 'Bank'
  });
  it('Hook to bank', function () {
    Bank.consumeChannel('l', console.log.bind(console, 'account'));
    return Bank.sessionCall('hook', {accounts: ['auser'], scan: true});
  });
  it('Charge auser', function () {
    return Bank.call('charge', 'auser', -10, ['another charge']);
  });
  it('Hook to bank txns', function () {
    Bank.consumeChannel('g', console.log.bind(console, 'txn'));
    return Bank.sessionCall('hookToLog', {filter: {
      values: {
        op: 'eq',
        field: 0,
        value: 'auser'
      }
    }, scan: true});
  });
});
