function run (sink, TestClass) {
  var auserh = new TestClass(sink, 'auser'),
    buserh = new TestClass(sink, 'buser');

  return [auserh.go(), buserh.go()];
}

function testTxns (execlib, sink) {
  'use strict';
  var _execlib = execlib,
    _sink = sink,
    _require = require,
    _runTest = runTest,
    lib = execlib.lib,
    q = lib.q,
    txnTesterLoader = function (leveldblib) {
        var ret = _require('./txntestercreator')(_execlib, leveldblib);
        _require = null;
        _execlib = null;
        return ret;
      },
      testRunner = function (txntesterclass) {
        _runTest(_sink, txntesterclass);
        _sink = null;
        _runTest = null;
      };
  return execlib.loadDependencies('client', ['allex_leveldblib'], txnTesterLoader).then(testRunner);
}

function resetterTo (sink, username) {
  var resettobalance = 150,
    aracb = afterResetAccountChecker.bind(null, username, resettobalance);
  if (Math.random() < 2.0) {
    return sink.call('resetTo', username, resettobalance, ['resetTo'], ['reset'], ['newState']).then(
      () => {
        var ret = sink.call('readAccount', username).then(aracb);
        sink = null;
        username = null;
        resettobalance = null;
        return ret;
      }
    );
  } else {
    console.log('random decided to skip resetTo for', username);
    return true;
  }
}

function runTest(sink, TxnTester) {
  var tt = new TxnTester(['auser', 'buser']);
  return tt.go(sink);
}

function afterResetAccountChecker(username, expectedbalance, obtainedbalance) {
  if (expectedbalance !== obtainedbalance) {
    console.error('expected', expectedbalance, 'got', obtainedbalance);
    throw new Error('Balance mismatch after reset, expected '+expectedbalance+', got '+obtainedbalance);
  }
  return true;
}

function resetter (sink, username) {
  return sink.call('reset', username, ['reset']);
}

function resettraverser (execlib, sink) {
  return execlib.loadDependencies('client', ['allex_leveldblib'], resettraverserrunner.bind(null, sink));
}

function resettraverserrunner (sink, leveldb) {
  return leveldb.streamInSink(sink, 'traverseResets', {pagesize:10, filter: betweenFilter()}, console.log.bind(console, 'reset'), function (d) {d.resolve(true);});
}

function betweenFilter () {
  return {
    op: 'and',
    filters: [{
      op: 'gte',
      field: 1,
      value: Date.now() - 1000
    },{
      op: 'lte',
      field: 1,
      value: Date.now()
    }]
  }
}

function randomUser() {
  return Math.random() < 2.5 ? 'auser' : 'buser';
}

function createTester (execlib, testclassmodulename, testername) {
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib,
    BankSinkHandler = require('./banksinkhandlerbasecreator')(execlib),
    TestClass = require('./'+testclassmodulename)(execlib, BankSinkHandler);

  function go (sink) {
    var _q = q, 
    _cl = console.log.bind(console, testername, 'successs'),
    _ce = console.error.bind(console, testername, 'error');
    return q.all(run(sink, TestClass)).then(
      testTxns.bind(null, execlib, sink)
    ).then(
      resetterTo.bind(null, sink, randomUser())
    ).then(
      resetter.bind(null, sink, randomUser())
    ).then(
      resettraverser.bind(null, execlib, sink)
    ).then(
      function (result) {
        var ret = _q(result);
        _cl(result);
        _q = null;
        _cl = null;
        _ce = null;
        sink = null;
        return ret;
      },
      function (reason) {
        var ret = _q.reject(reason);
        _ce(reason);
        _q = null;
        _cl = null;
        _ce = null;
        sink = null;
        return ret;
      }
    )
  };

  go.destroy = function () {
    q = null;
    qlib = null;
    BankSinkHandler = null;
    SimpleAccountHandler = null;
  }

  return go;

}

module.exports = createTester;
