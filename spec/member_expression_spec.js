var string = 'Hello';
var length = string.length;

require('./spec_helper.js');

describe('Pseudocode.MemberExpression', function() {
  var pseudocode = loadFile(__filename);

  function typeOfChild(index) {
    var child = pseudocode.program.children[index];
    return child.children[0].init.dataType;
  }

  it('infers an integer type for properties with clear names like "length"', function() {
    expect(typeOfChild(1)).toEqual('int');
  });
});
