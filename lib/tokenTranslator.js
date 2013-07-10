var Lazy = require('lazy.js');

function TokenTranslator(parts) {
  this.parts = parts;
}

TokenTranslator.prototype.toSnakeCase = function() {
  var lowerCaseParts = Lazy(this.parts).map(function(str) {
    return str.toLowerCase();
  })

  return lowerCaseParts.join('_');
};

function fromCamelCase(token) {
  var match,
      index = 0,
      parts = [];

  var pattern = /[^A-Z][A-Z]/g;
  while (match = pattern.exec(token)) {
    parts.push(token.substring(index, match.index + 1));
    index = match.index + 1;
  }

  if (index < token.length - 1) {
    parts.push(token.substring(index));
  }

  return new TokenTranslator(parts);
}

global.TokenTranslator = TokenTranslator;
global.fromCamelCase = fromCamelCase;