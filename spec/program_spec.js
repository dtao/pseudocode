require('./spec_helper.js');

describe('Pseudocode.Program', function() {
  var binarySearch = loadFile('./samples/binarySearch.js').program;

  describe('getIdentifiers', function() {
    it('provides a list of the identifiers under the current scope', function() {
      expect(binarySearch.getIdentifiers()).toEqual(['binarySearch']);
    });
  });  
});
