var specHelper = require('./spec_helper.js');

describe('Pseudocode', function() {
  var binarySearch = specHelper.loadFile('./samples/binarySearch.js');
  var countingSort = specHelper.loadFile('./samples/countingSort.js');
  var set = specHelper.loadFile('./samples/set.js');

  describe('getIdentifiers', function() {
    describe('binary search example', function() {
      it('provides a list of the identifiers under a given scope', function() {
        expect(binarySearch.getIdentifiers()).toEqual({
          'binarySearch': {
            dataType: 'func<int>'
          }
        });
      });

      it('provides recursive access to all of the identifiers in a program', function() {
        expect(binarySearch.getIdentifiers(true)).toEqual({
          'binarySearch': {
            dataType: 'func<int>',
            identifiers: {
              'haystack': { dataType: 'array<int>' },
              'needle': { dataType: 'int' },
              'low': { dataType: 'int' },
              'high': { dataType: 'int' },
              'current': { dataType: 'int' }
            }
          },
        });
      });
    });

    describe('counting sort example', function() {
      it('provides recursive access to all the identifies in the program', function() {
        expect(countingSort.getIdentifiers(true)).toEqual({
          'countingSort': {
            dataType: 'func<array<int>>',
            identifiers: {
              'array': { dataType: 'array<int>' },
              'range': { dataType: 'array' },
              'min': { dataType: 'int' },
              'counts': { dataType: 'array<int>' },
              'i': { dataType: 'int' },
              'result': { dataType: 'array<int>' }
            }
          },
          'createArray': {
            dataType: 'func<array<int>>',
            identifiers: {
              'range': { dataType: 'array<int>' },
              'arr': { dataType: 'array<int>' },
              'i': { dataType: 'int' }
            }
          },
          'minMax': {
            dataType: 'func<array<int>>',
            identifiers: {
              'array': { dataType: 'array<int>' },
              'min': { dataType: 'int' },
              'max': { dataType: 'int' },
              'i': { dataType: 'int' }
            }
          }
        });
      });
    });
  });
});
