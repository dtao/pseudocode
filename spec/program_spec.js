require('./spec_helper.js');

describe('Pseudocode.Program', function() {
  var binarySearch = loadFile('./samples/binarySearch.js').program;

  describe('getIdentifiers', function() {
    it('provides a list of the identifiers under the current scope', function() {
      expect(binarySearch.getIdentifiers()).toEqual(['binarySearch']);
    });
  });

  describe('getNodeForIdentifier', function() {
    it('provides access to specific nodes (e.g., function declarations) that are uniquely identified', function() {
      var functionDecl = binarySearch.getNodeForIdentifier('binarySearch');
      expect(functionDecl.type).toEqual('FunctionDeclaration');
      expect(functionDecl.getIdentifiers()).toBeEquivalentTo(['haystack', 'needle', 'low', 'high', 'current']);
    });
  });
});
