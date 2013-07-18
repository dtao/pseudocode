var fs = require('fs');
var Lazy = require('lazy.js');
var Pseudocode = require('../pseudocode.js');

function loadFile(filename) {
  return Pseudocode.fromJavaScript(fs.readFileSync(filename, 'utf-8')).program;
}

function removeFromArray(array, element) {
  for (var i = array.length - 1; i >= 0; --i) {
    if (array[i] === element) {
      array.splice(i, 1);
    }
  }
}

beforeEach(function() {
  this.addMatchers({
    toHaveIdentifiers: function(recursive, expected) {
      var actual     = this.actual.getIdentifiers(recursive),
          mismatches = [];

      var verifyIdentifiers = function(identifiers, reference, scopeName) {
        var actualKeys = Lazy(reference).keys().toArray();

        var formatName = scopeName ?
          function(name) { return scopeName + '::' + name; } :
          function(name) { return name; };

        Lazy(identifiers).each(function(identifier) {
          var name = identifier[0],
              type = identifier[1],
              children = identifier[2] || [],
              actualData = reference[name];

          removeFromArray(actualKeys, name);

          if (!actualData) {
            mismatches.push('Expected to find identifier "' + formatName(name) + '" with type ' + type);
            return;
          }

          if (actualData.dataType !== type) {
            mismatches.push('Expected ' + formatName(name) + ' to have type ' + type +
              ' (was ' + actualData.dataType + ')');
          }

          if (actualData.identifiers) {
            verifyIdentifiers(children, actualData.identifiers, formatName(name));

          } else if (children.length > 0) {
            Lazy(children).each(function(child) {
              mismatches.push('Expected ' + formatName(name) + ' to include ' + child[0]);
            });
          }
        });

        Lazy(actualKeys).each(function(key) {
          mismatches.push('Found identifier "' + formatName(key) + '" but was not expecting it.');
        });
      };

      verifyIdentifiers(expected, actual);

      this.message = function() {
        return ['Encountered the following issues:'].concat(mismatches).join('\n     - ');
      };

      return mismatches.length === 0;
    }
  });
});

module.exports = {
  loadFile: loadFile
};
