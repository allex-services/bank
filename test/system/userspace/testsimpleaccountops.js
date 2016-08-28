function run (sink, SimpleAccountHandler) {
  var auserh = new SimpleAccountHandler(sink, 'auser'),
    buserh = new SimpleAccountHandler(sink, 'buser');

  return [auserh.go(), buserh.go()];
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
  qlib.promise2console(q.all(run(taskobj.sink, SimpleAccountHandler)), 'SimpleAccountOpsTest');
}


module.exports = {
  sinkname: 'Bank',
  identity: {name: 'user', role: 'user'},
  task: {
    name: go
  }
};
