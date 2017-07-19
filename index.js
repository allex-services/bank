function createServicePack(execlib) {
  'use strict';

  return {
    service: {
      dependencies: ['allex:leveldbwithlog', 'allex_leveldbbanklib', 'allex_leveldblib']
    },
    sinkmap: {
      dependencies: ['allex:leveldbwithlog']
    }
  };
}

module.exports = createServicePack;
