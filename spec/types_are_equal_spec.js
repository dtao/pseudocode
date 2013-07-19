var Pseudocode = require('./spec_helper.js').Pseudocode;

describe('Pseudocode', function() {
  describe('typesAreEqual', function() {
    function result(x, y) {
      return Pseudocode.typesAreEqual(x, y);
    }

    it('types with the same name are equal', function() {
      expect(result('string', 'string')).toBe(true);
    });

    it('types with different names are unequal', function() {
      expect(result('string', 'int')).toBe(false);
    });

    it('the string "array" is not the same as a strongly-typed collection type with no element type', function() {
      expect(result('array', new Pseudocode.CollectionType())).toBe(false);
    });

    it('collection types with the same element type are equal', function() {
      var collectionType1 = new Pseudocode.CollectionType('string');
      var collectionType2 = new Pseudocode.CollectionType('string');
      expect(result(collectionType1, collectionType2)).toBe(true);
    });

    it('collection types with different element types are unequal', function() {
      var collectionType1 = new Pseudocode.CollectionType('string');
      var collectionType2 = new Pseudocode.CollectionType('int');
      expect(result(collectionType1, collectionType2)).toBe(false);
    });

    it('the string "function" is not the same as a strongly-typed function type with no return type', function() {
      expect(result('function', new Pseudocode.FunctionType())).toBe(false);
    });

    it('function types with the same return types are equal', function() {
      var functionType1 = new Pseudocode.FunctionType('string');
      var functionType2 = new Pseudocode.FunctionType('string');
      expect(result(functionType1, functionType2)).toBe(true);
    });

    it('function types with different return types are unequal', function() {
      var functionType1 = new Pseudocode.FunctionType('string');
      var functionType2 = new Pseudocode.FunctionType('int');
      expect(result(functionType1, functionType2)).toBe(false);
    });
  });
});
