var string    = 'Hello';
var firstChar = string.charAt(0);
var substring = string.substring(1);
var substr    = string.substr(1);
var split     = string.split('');

require('./spec_helper.js');

describe('Pseudocode.CallExpression', function() {
  var pseudocode = loadFile(__filename);

  function typeOfChild(index) {
    var child = pseudocode.program.children[index];
    return child.children[0].init.dataType;
  }

  it('infers a char type for the result of calling charAt on a string', function() {
    expect(typeOfChild(1)).toEqual('char');
  });

  it('infers a string type for the result of calling substring on a string', function() {
    expect(typeOfChild(2)).toEqual('string');
  });

  it('infers a string type for the result of calling substr on a string', function() {
    expect(typeOfChild(3)).toEqual('string');
  });

  it('infers an Array<string> type for the result of calling split on a string', function() {
    expect(typeOfChild(4)).toEqual({
      collectionType: 'array',
      elementType: 'string'
    });
  });
});
