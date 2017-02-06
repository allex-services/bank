loadMochaIntegration('allex_leveldblib');
describe('Testing query', function () {
  loadClientSide(['allex:leveldb:lib']);
  findSinkIt({
    sinkname: 'Bank'
  });
  createSinkLevelDBQueryIt({
    instancename: 'QueryBank',
    sinkname: 'Bank',
    scaninitially: true,
    filter: {
      keys: {
        op: 'eq',
        field: null,
        value: 'auser'
      }
    },
    cb: console.log.bind(console, 'bank query')
  });
  createSinkLevelDBQueryIt({
    instancename: 'QueryTxns',
    sinkname: 'Bank',
    methodname: 'queryLog',
    scaninitially: false,
    filter: {
      values: {
        op: 'startswith',
        field: 0,
        value: 'aus'
      }
    },
    cb: console.log.bind(console, 'txn query')
  });
  it('Charge auser', function () {
    return Bank.call('charge', 'auser', -10, ['another charge']);
  });
});
