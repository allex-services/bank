module.exports = {
  charge: [{
    title: 'User name',
    type: 'string',
    strongtype: 'String'
  },{
    title: 'Amount',
    type: 'number',
    strongtype: 'Int32LE'
  }],
  reserve: [{
    title: 'User name',
    type: 'string',
    strongtype: 'String'
  },{
    title: 'Amount',
    type: 'number',
    strongtype: 'UInt32LE'
  }],
  commitReservation: [{
    title: 'Reservation ID',
    type: 'number',
    strongtype: 'UInt32LE'
  }]
};
