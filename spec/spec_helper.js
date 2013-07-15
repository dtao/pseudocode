var fs = require('fs');
var Lazy = require('lazy.js');
var Pseudocode = require('../pseudocode.js');

function loadFile(filename) {
  return Pseudocode.fromJavaScript(fs.readFileSync(filename, 'utf-8'));
}

function getSpecDepth(spec) {
  var depth = 0;
  var suite = spec.suite;
  while (suite.parentSuite) {
    depth += 1;
    suite = suite.parentSuite;
  }
  return depth;
}

function indent(string) {
  return '     ' + string;
}

beforeEach(function() {
  this.addMatchers({
    toBeEquivalentTo: function(expected) {
      var difference = Lazy(this.actual).difference(expected).toArray();

      this.message = function() {
        var depth = getSpecDepth(this.spec);
        return 'Expected: ' + JSON.stringify(this.actual) + '\n' +
          indent('to be equivalent to: ' + JSON.stringify(expected)) + '\n' +
          indent('Difference: ' + JSON.stringify(difference));
      };

      return difference.length === 0;
    }
  });
});

global.loadFile = loadFile;
