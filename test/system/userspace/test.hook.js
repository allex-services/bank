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
});
