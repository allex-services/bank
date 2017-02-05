function doQuery (sink, methodname, filters) {
  var d = q.defer(), ret = d.promise;
  taskRegistry.run('queryLevelDB', {
    queryMethodName: methodname,
    sink: sink,
    filter: filters,
    scanInitially: true,
    onPut: console.log.bind(console, 'qput'),
    onDel: console.log.bind(console, 'qdel'),
    onInit: d.resolve.bind(d)
  });
  return ret;
}
describe('Testing query', function () {
  loadClientSide(['allex:leveldb:lib']);
  findSinkIt({
    sinkname: 'Bank'
  });
  it('Query bank', function () {
    return doQuery(Bank, 'query', {
      values: {
        op: 'eq',
        field: null,
        value: 'auser'
      }
    });
  });
  it('Charge auser', function () {
    return Bank.call('charge', 'auser', -10, ['another charge']);
  });
  it('Query bank txns', function () {
    return doQuery(Bank, 'queryLog', {
      values: {
        op: 'startswith',
        field: 0,
        value: 'aus'
      }
    });
  });
});
