var Pseudocode = require('./spec_helper.js').Pseudocode;

describe('Pseudocode', function() {
  function inferTypes(javaScript, expectedTypes) {
    var program = Pseudocode.fromJavaScript(javaScript).program;
    for (var name in expectedTypes) {
      expect(String(program.getIdentifier(name).getDataType())).toEqual(expectedTypes[name]);
    }
  }

  describe('type inference', function() {
    it('infers a type of int or string from the + operator', function() {
      inferTypes('var x = foo + bar;', {
        'x': 'int|string'
      });
    });

    it('infers int if either side of the + operator is an int', function() {
      inferTypes('var x = foo + 5;', {
        'x': 'int'
      });
    });

    it('correctly uses known function return types where possible', function() {
      inferTypes('var x = foo(); function foo() { return 5; }', {
        'foo': 'func<int>',
        'x': 'int'
      });
    });

    it('assumes an int type for identifiers on both sides of the "-" operator', function() {
      inferTypes('var foo; var bar; var diff = foo - bar;', {
        'foo': 'int',
        'bar': 'int',
        'diff': 'int'
      });
    });

    it('propagates type inference upward to parent scopes', function() {
      inferTypes('var arr = []; function f() { arr.push("foo"); }', {
        'arr': 'array<string>'
      });
    });

    it('infers a string from calling charAt', function() {
      inferTypes('var str; str.charAt(0);', {
        'str': 'string'
      });
    });
  });
});
