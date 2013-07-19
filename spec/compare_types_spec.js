var Pseudocode = require('./spec_helper.js').Pseudocode;

describe('Pseudocode', function() {
  describe('compareTypes', function() {
    function result(x, y) {
      return Pseudocode.compareTypes(x, y);
    }

    describe('in general', function() {
      it('everything overrides "object"', function() {
        expect(result('string', 'object')).toEqual(1);
      });
    });

    describe('for arrays', function() {
      var weakType = 'array';
      var strongType = new Pseudocode.CollectionType({ elementType: 'string' });

      it('a strongly-typed array overrides plain "array"', function() {
        expect(result(strongType, weakType)).toEqual(1);
      });

      it('a plain "array" is overridden by a strongly-typed collection', function() {
        expect(result(weakType, strongType)).toEqual(-1);
      });

      it('random other types are treated as equal', function() {
        expect(result(weakType, 'int')).toEqual(0);
      });
    });

    describe('for functions', function() {
      var weakType = 'function';
      var strongType = new Pseudocode.FunctionType('object');
      var strongerType = new Pseudocode.FunctionType('array');
      var strongestType = new Pseudocode.FunctionType(
        new Pseudocode.CollectionType({ elementType: 'string' })
      );

      it('a strongly-typed function overrides plain "function"', function() {
        expect(result(strongType, weakType)).toEqual(1);
      })

      it('a plain "function" is overridden by a strongly-typed function', function() {
        expect(result(weakType, strongType)).toEqual(-1);
      });

      it('a function with a stronger return type overrides one with a weaker return type', function() {
        expect(result(strongerType, strongType)).toEqual(1);
      });

      it('a function with a strong collection return type overrides one with a plain "array" return type', function() {
        expect(result(strongestType, strongerType)).toEqual(1);
      });
    });
  });
});
