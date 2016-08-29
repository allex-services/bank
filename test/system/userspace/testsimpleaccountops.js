var _betweenflt = {
    op: 'and',
    filters: [{
      op: 'gte',
      field: 1,
      value: 1472483135562
    },{
      op: 'lte',
      field: 1,
      value: 1472483937409
    }]
  },
  _userflt = {
    op: 'eq',
    field: 0,
    value: 'buser'
  };
function resettraverserrunner (sink, leveldb) {
  return leveldb.streamInSink(sink, 'traverseResets', {pagesize:10, filter: _betweenflt}, console.log.bind(console, 'reset'), function (d) {d.resolve(true);});
}

function resettraverser (execlib, sink) {
  return execlib.loadDependencies('client', ['allex:leveldb:lib'], resettraverserrunner.bind(null, sink));
}

function resetter (sink, username) {
  return sink.call('reset', username);
}

function run (sink, SimpleAccountHandler) {
  var auserh = new SimpleAccountHandler(sink, 'auser'),
    buserh = new SimpleAccountHandler(sink, 'buser');

  return [auserh.go(), buserh.go()];
}

function runTest(sink, TxnTester) {
  var tt = new TxnTester(['auser', 'buser']);
  return tt.go(sink);
}

function testTxns (execlib, sink) {
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    txnTesterDefer = q.defer(),
    txnTesterLoader = require('./txntestercreator').bind(null, execlib);
  return execlib.loadDependencies('client', ['allex:leveldb:lib'], txnTesterLoader).then(runTest.bind(null, sink));
}

function go (taskobj) {
  var BankSinkHandler, SimpleAccountHandler, q, qlib;
  if (!(taskobj && taskobj.sink)) {
    process.exit(0);
  }
  q = taskobj.execlib.lib.q;
  qlib = taskobj.execlib.lib.qlib;
  BankSinkHandler = require('./banksinkhandlerbasecreator')(taskobj.execlib);
  SimpleAccountHandler = require('./simpleaccounthandlercreator')(taskobj.execlib, BankSinkHandler);
  q.all(run(taskobj.sink, SimpleAccountHandler)).then(
    testTxns.bind(null, taskobj.execlib, taskobj.sink)
  ).then(
    resetter.bind(null, taskobj.sink, 'auser')
  ).then(
    resettraverser.bind(null, taskobj.execlib, taskobj.sink)
  ).then(
    function (result) {
      console.log('success', result);
      go(taskobj);
      taskobj = null;
      q = null;
      qlib = null;
      BankSinkHandler = null;
      SimpleAccountHandler = null;
    },
    function (error) {
      console.error('error', error);
      taskobj = null;
      q = null;
      qlib = null;
      BankSinkHandler = null;
      SimpleAccountHandler = null;
    }
  )
}


module.exports = {
  sinkname: 'Bank',
  identity: {name: 'user', role: 'user'},
  task: {
    name: go
  }
};
