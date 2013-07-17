var specHelper = require('./spec_helper.js');

describe('Pseudocode', function() {
  var binarySearch = specHelper.loadFile('./samples/binarySearch.js');
  var countingSort = specHelper.loadFile('./samples/countingSort.js');

  describe('getIdentifiers', function() {
    it('provides a list of the identifiers under a given scope', function() {
      expect(binarySearch.getIdentifiers()).toEqual({
        'binarySearch': { dataType: 'function' }
      });
    });

    it('provides recursive access to all of the identifiers in a program', function() {
      expect(binarySearch.getIdentifiers(true)).toEqual({
        'binarySearch': {
          dataType: 'function',
          identifiers: {
            'haystack': { dataType: 'array' },
            'needle': { dataType: 'int' },
            'low': { dataType: 'int' },
            'high': { dataType: 'int' },
            'current': { dataType: 'int' }
          }
        },
      });

      expect(countingSort.getIdentifiers(true)).toEqual({
        'countingSort': {
          dataType: 'function',
          identifiers: {
            'array': { dataType: 'array' },
            'range': { dataType: 'array' },
            'min': { dataType: 'int' },
            'counts': { dataType: 'array' },
            'i': { dataType: 'int' },
            'result': { dataType: 'array' }
          }
        },
        'createArray': {
          dataType: 'function',
          identifiers: {
            'range': { dataType: 'array' },
            'arr': { dataType: 'array' },
            'i': { dataType: 'int' }
          }
        },
        'minMax': {
          dataType: 'function',
          identifiers: {
            'array': { dataType: 'array' },
            'min': { dataType: 'int' },
            'max': { dataType: 'int' },
            'i': { dataType: 'int' }
          }
        }
      });
    });
  });
});
