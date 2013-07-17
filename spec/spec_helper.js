var fs = require('fs');
var Lazy = require('lazy.js');
var Pseudocode = require('../pseudocode.js');

function loadFile(filename) {
  return Pseudocode.fromJavaScript(fs.readFileSync(filename, 'utf-8')).program;
}

beforeEach(function() {
  var origToEqual = jasmine.Matchers.prototype.toEqual;

  this.addMatchers({
    toEqual: function(expected) {
      var diffKeys = [],
          diffValues = [];

      if (typeof this.actual === 'object' && typeof expected === 'object') {
        this.env.compareObjects_(this.actual, expected, diffKeys, diffValues);

        this.message = function() {
          return diffKeys.concat(diffValues).join('\n     ');
        };

        return diffKeys.length + diffValues.length === 0;
      }

      return origToEqual.call(this, this.actual, expected);
    }
  });
});

module.exports = {
  loadFile: loadFile
};
