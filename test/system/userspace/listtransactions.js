var _users;

function txnprocessor (txnobj) {
  console.log('txnobj', txnobj);
  var txn = txnobj.value,
    user = txn[0],
    amount = txn[1],
    balance = _users.get(user);
  if (!balance) {
    balance = 0;
  }
  _users.replace(user, balance-amount);
  console.log(user, ':', _users.get(user));
}

function run(taskobj, leveldblib) {
  leveldblib.streamInSink(taskobj.sink,
    'traverseTransactions', 
    {pagesize: 5},
    txnprocessor,
    function (d) {d.resolve(true);}
  );

}

function go (taskobj) {
  var BankSinkHandler, SimpleAccountHandler;
  if (!(taskobj && taskobj.sink)) {
    process.exit(0);
  }
  _users = new taskobj.execlib.lib.Map();
  taskobj.execlib.loadDependencies('client', ['allex:leveldb:lib'], run.bind(null, taskobj));
}

module.exports = {
  sinkname: 'Bank',
  identity: {name: 'user', role: 'user'},
  task: {
    name: go
  }
};
