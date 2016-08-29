module.exports = {
  readAccount: [{
    title: 'User name',
    type: 'string',
    strongtype: 'String'
  }],
  closeAccount: [{
    title: 'User name',
    type: 'string',
    strongtype: 'String'
  }],
  charge: [{
    title: 'User name',
    type: 'string',
    strongtype: 'String'
  },{
    title: 'Amount',
    type: 'number',
    strongtype: 'Int32LE'
  },{
    title: 'Reference',
    type: 'array',
    strongtype: 'Buffer'
  }],
  reserve: [{
    title: 'User name',
    type: 'string',
    strongtype: 'String'
  },{
    title: 'Amount',
    type: 'number',
    strongtype: 'UInt32LE'
  },{
    title: 'Reference',
    type: 'array',
    strongtype: 'Buffer'
  }],
  commitReservation: [{
    title: 'Reservation ID',
    type: 'number',
    strongtype: 'UInt32LE'
  },{
    title: 'Reservation control code',
    type: 'string',
    strongtype: 'String'
  },{
    title: 'Reference',
    type: 'array',
    strongtype: 'Buffer'
  }],
  cancelReservation: [{
    title: 'Reservation ID',
    type: 'number',
    strongtype: 'UInt32LE'
  },{
    title: 'Reservation control code',
    type: 'string',
    strongtype: 'String'
  },{
    title: 'Reference',
    type: 'array',
    strongtype: 'Buffer'
  }],
  traverseAccounts: [{
    title: 'Traverse options',
    type: 'object'
  }],
  traverseTransactions: [{
    title: 'Traverse options',
    type: 'object'
  }],
  traverseReservations: [{
    title: 'Traverse options',
    type: 'object'
  }],
  reset: [{
    title: 'User name',
    type: 'string'
  }]
};
