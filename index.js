function createServicePack(execlib) {
  'use strict';

  return {
    service: {
      dependencies: ['allex:leveldbwithlog', 'allex:leveldbbank:lib', 'allex:leveldb:lib']
    },
    sinkmap: {
      dependencies: ['allex:leveldbwithlog']
    }
  };
}

module.exports = createServicePack;
