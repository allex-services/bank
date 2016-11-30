function createBankService(execlib, ParentService, leveldbbanklib, leveldblib) {
  'use strict';
  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib,
    BankMixin = leveldbbanklib.BankMixin;

  function factoryCreator(parentFactory) {
    return {
      'service': require('./users/serviceusercreator')(execlib, parentFactory.get('service')),
      'user': require('./users/usercreator')(execlib, parentFactory.get('user'), leveldblib) 
    };
  }

  function BankService(prophash) {
    BankMixin.call(this, prophash);
    ParentService.call(this, prophash);
  }
  
  ParentService.inherit(BankService, factoryCreator);
  BankMixin.addMethods(BankService);
  
  BankService.prototype.__cleanUp = function() {
    ParentService.prototype.__cleanUp.call(this);
    BankMixin.prototype.destroy.call(this);
  };

  BankService.prototype.propertyHashDescriptor = {
    path: {
      type: 'string'
    }
  };

  return BankService;
}

module.exports = createBankService;
