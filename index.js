function createServicePack(execlib) {
  'use strict';

  return {
    service: {
      dependencies: ['allex_leveldbwithlogservice', 'allex_leveldbbanklib', 'allex_leveldblib']
    },
    sinkmap: {
      dependencies: ['allex_leveldbwithlogservice']
    }
  };
}

module.exports = createServicePack;
