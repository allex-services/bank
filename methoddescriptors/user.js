module.exports = {
  readAccount: [{
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
    type: 'string',
    strongtype: 'String'
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
    type: 'string',
    strongtype: 'String'
  }],
  commitReservation: [{
    title: 'Reservation ID',
    type: 'number',
    strongtype: 'UInt32LE'
  },{
    title: 'Reservation control code',
    type: 'string',
    strongtype: 'String'
  }]
};
