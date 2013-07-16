var specHelper = require('./spec_helper.js');

describe('Pseudocode', function() {
  var binarySearch = specHelper.loadFile('./samples/binarySearch.js');

  describe('getIdentifiers', function() {
    it('provides a list of the identifiers under a given scope', function() {
      expect(binarySearch.getIdentifiers()).toEqual(['binarySearch']);
    });

    it('provides recursive access to all of the identifiers in a program', function() {
      expect(binarySearch.getIdentifiers(true)).toEqual([
        ['binarySearch', 'function', [
          ['haystack', 'array'],
          ['needle', 'object'],
          ['low', 'int'],
          ['high', 'int'],
          ['current', 'int']]
        ]
      ]);
    });
  });
});
