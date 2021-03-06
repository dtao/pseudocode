var specHelper = require('./spec_helper.js');

describe('Pseudocode', function() {
  var binarySearch = specHelper.loadFile('./samples/binarySearch.js');
  var countingSort = specHelper.loadFile('./samples/countingSort.js');

  describe('getIdentifiers', function() {
    describe('binary search example', function() {
      it('provides a list of the identifiers under a given scope', function() {
        expect(binarySearch).toHaveIdentifiers(false, [
          ['binarySearch', 'func<int>']
        ]);
      });

      it('provides recursive access to all of the identifiers in a program', function() {
        expect(binarySearch).toHaveIdentifiers(true, [
          [
            'binarySearch', 'func<int>', [
              ['haystack', 'array<int|string>'],
              ['needle', 'int|string'],
              ['low', 'int'],
              ['high', 'int'],
              ['current', 'int']
            ]
          ]
        ]);
      });
    });

    describe('counting sort example', function() {
      it('provides recursive access to all the identifies in the program', function() {
        expect(countingSort).toHaveIdentifiers(true, [
          [
            'countingSort', 'func<list<int>>', [
              ['array', 'array<int>'],
              ['range', 'array<int>'],
              ['min', 'int'],
              ['counts', 'array<int>'],
              ['i', 'int'],
              ['result', 'list<int>']
            ]
          ],
          [
            'createArray', 'func<list<int>>', [
              ['range', 'array<int>'],
              ['arr', 'list<int>'],
              ['i', 'int']
            ]
          ],
          [
            'minMax', 'func<array<int|string>>', [
              ['array', 'array<int|string>'],
              ['min', 'int|string'],
              ['max', 'int|string'],
              ['i', 'int']
            ]
          ]
        ]);
      });
    });
  });
});
