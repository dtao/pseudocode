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
      var strongType = new Pseudocode.CollectionType('string');

      it('a strongly-typed array overrides plain "array"', function() {
        expect(result(strongType, weakType)).toEqual(1);
      });

      it('a plain "array" is overridden by a strongly-typed collection', function() {
        expect(result(weakType, strongType)).toEqual(-1);
      });

      it('random other types are treated as equal', function() {
        expect(result(weakType, 'int')).toEqual(0);
      });

      it('a collection of known type overrides a collection of amibiguous type', function() {
        var amibiguousType = new Pseudocode.CollectionType(
          new Pseudocode.AmbiguousType(['string', 'int'])
        );
        expect(result(strongType, amibiguousType)).toEqual(1);
        expect(result(amibiguousType, strongType)).toEqual(-1);
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

      it('a function of known return type overrides a function of ambiguous return type', function() {
        var stringType = new Pseudocode.FunctionType('string');
        var amibiguousType = new Pseudocode.FunctionType(
          new Pseudocode.AmbiguousType(['string', 'int'])
        );
        expect(result(stringType, amibiguousType)).toEqual(1);
        expect(result(amibiguousType, stringType)).toEqual(-1);
      });
    });

    describe('for ambiguous types', function() {
      var weakType = new Pseudocode.AmbiguousType(['string', 'int', 'bool']);
      var strongType = new Pseudocode.AmbiguousType(['string', 'int']);
      var otherType = new Pseudocode.AmbiguousType(['string', 'bool']);

      it('a string overrides an ambiguous type whose possibilities include that string', function() {
        expect(result('string', weakType)).toEqual(1);
        expect(result(weakType, 'string')).toEqual(-1);
      });

      it('an ambiguous type w/ 2 possibilities overrides one with those same 2 + another', function() {
        expect(result(strongType, weakType)).toEqual(1);
        expect(result(weakType, strongType)).toEqual(-1);
      });

      it('two ambiguous types with different options are treated as equal', function() {
        expect(result(strongType, otherType)).toEqual(0);
      });
    });
  });
});
