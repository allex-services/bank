(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
ALLEX.execSuite.registry.add('allex_bankservice',require('./clientside')(ALLEX, ALLEX.execSuite.registry.get('.')));

},{"./clientside":2}],2:[function(require,module,exports){
function createClientSide(execlib) {
  'use strict';
  var execSuite = execlib.execSuite,
  ParentServicePack = execSuite.registry.get('.');

  return {
    SinkMap: require('./sinkmapcreator')(execlib, ParentServicePack)
  };
}

module.exports = createClientSide;

},{"./sinkmapcreator":5}],3:[function(require,module,exports){
module.exports = {
};

},{}],4:[function(require,module,exports){
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

},{}],5:[function(require,module,exports){
function sinkMapCreator(execlib, ParentServicePack) {
  'use strict';
  var sinkmap = new (execlib.lib.Map), ParentSinkMap = ParentServicePack.SinkMap;
  sinkmap.add('service', require('./sinks/servicesinkcreator')(execlib, ParentSinkMap.get('service')));
  sinkmap.add('user', require('./sinks/usersinkcreator')(execlib, ParentSinkMap.get('user')));
  
  return sinkmap;
}

module.exports = sinkMapCreator;

},{"./sinks/servicesinkcreator":6,"./sinks/usersinkcreator":7}],6:[function(require,module,exports){
function createServiceSink(execlib, ParentSink) {
  'use strict';
  if (!ParentSink) {
    ParentSink = execlib.execSuite.registry.get('.').SinkMap.get('user');
  }

  function ServiceSink(prophash, client) {
    ParentSink.call(this, prophash, client);
  }
  
  ParentSink.inherit(ServiceSink, require('../methoddescriptors/serviceuser'));
  ServiceSink.prototype.__cleanUp = function () {
    ParentSink.prototype.__cleanUp.call(this);
  };
  return ServiceSink;
}

module.exports = createServiceSink;

},{"../methoddescriptors/serviceuser":3}],7:[function(require,module,exports){
function createUserSink(execlib, ParentSink) {
  'use strict';
  if (!ParentSink) {
    ParentSink = execlib.execSuite.registry.get('.').SinkMap.get('user');
  }

  function UserSink(prophash, client) {
    ParentSink.call(this, prophash, client);
  }
  
  ParentSink.inherit(UserSink, require('../methoddescriptors/user'));
  UserSink.prototype.__cleanUp = function () {
    ParentSink.prototype.__cleanUp.call(this);
  };
  return UserSink;
}

module.exports = createUserSink;

},{"../methoddescriptors/user":4}]},{},[1]);
