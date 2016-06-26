function createServicePack(execlib) {
  'use strict';

  return {
    service: {
      dependencies: ['.', 'allex:leveldb:lib', 'allex:buffer:lib']
    },
    sinkmap: {
      dependencies: ['.']
    }
  };
}

module.exports = createServicePack;
