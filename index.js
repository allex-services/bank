function createServicePack(execlib) {
  'use strict';

  return {
    service: {
      dependencies: ['allex:leveldbwithlog', 'allex:leveldb:lib', 'allex:buffer:lib']
    },
    sinkmap: {
      dependencies: ['allex:leveldbwithlog', 'allex:leveldb:lib']
    }
  };
}

module.exports = createServicePack;
