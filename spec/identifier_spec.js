var string  = 'Hello';
var integer = 5;
var decimal = 3.14;
var bool    = true;

require('./spec_helper.js');

describe('Pseudocode.Identifier', function() {
  var pseudocode = loadFile(__filename);

  function typeOfChild(index) {
    var child = pseudocode.program.children[index];
    return child.children[0].id.inferType();
  }

  it('infers the type of string literals', function() {
    expect(typeOfChild(0)).toEqual('string');
  });

  it('infers the type of integer literals', function() {
    expect(typeOfChild(1)).toEqual('int');
  });

  it('infers the type of floating point literals', function() {
    expect(typeOfChild(2)).toEqual('double');
  });

  it('infers the type of boolean literals', function() {
    expect(typeOfChild(3)).toEqual('bool');
  });
});
