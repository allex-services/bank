var _userflt = {
    op: 'eq',
    field: 0,
    value: 'buser'
  };

function run (simpletester, starterwithresettotester, sink) {
  if (!sink.destroyed) {
    console.error('sink is dead');
    process.exit(1);
    return;
  }
  starterwithresettotester(sink).then(
    simpletester.bind(simpletester, sink)
  ).then(
    function () {
      run(simpletester, starterwithresettotester, sink);
      simpletester = null;
      starterwithresettotester = null;
      sink = null;
    }
  );
}

function go (taskobj) {
  if (!(taskobj && taskobj.sink)) {
    process.exit(0);
  }
  var simpletester = require('./sequencetestercreator')(taskobj.execlib, 'simpleaccounthandlercreator', 'SimpleHandler'),
    starterwithresettotester = require('./sequencetestercreator')(taskobj.execlib, 'starterwithresettohandlercreator', 'StarterWithResetTo');
  run (simpletester, starterwithresettotester, taskobj.sink);
}


describe('Test simple bank ops', function () {
  findSinkIt({
    sinkname: 'Bank',
    identity: {name: 'user', role: 'user'},
  });
  it('doing ops', function () {
    this.timeout(1e8);
    var simpletester = require('./sequencetestercreator')(execlib, 'simpleaccounthandlercreator', 'SimpleHandler'),
      starterwithresettotester = require('./sequencetestercreator')(execlib, 'starterwithresettohandlercreator', 'StarterWithResetTo');
    run (simpletester, starterwithresettotester, Bank);
  });
});
