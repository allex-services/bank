function createServicePack(execlib) {
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    d = q.defer(),
    execSuite = execlib.execSuite,
    libRegistry = execSuite.libRegistry,
    ParentServicePack = execSuite.registry.get('.');

  libRegistry.register('allex_leveldblib').then(
    registerBufferLib.bind(null, d),
    d.reject.bind(d)
  );

  function registerBufferLib(defer, leveldblib) {
    libRegistry.register('allex_bufferlib').then(
      realCreator.bind(null, defer, leveldblib),
      defer.reject.bind(defer)
    );
  }

  function realCreator(defer, leveldblib, bufferlib) {
    var ret = require('./clientside')(execlib);
    ret.Service = require('./servicecreator')(execlib, ParentServicePack, leveldblib, bufferlib);
    defer.resolve(ret);
  }

  return d.promise;
}

module.exports = createServicePack;
