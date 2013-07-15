var Lazy = require('lazy.js');

function toPascalCase(token) {
  var capitalizedParts = Lazy(getParts(token)).map(function(str) {
    return str.charAt(0).toUpperCase() + str.substring(1);
  })

  return capitalizedParts.join('');
}

function toSnakeCase(token) {
  var lowerCaseParts = Lazy(getParts(token)).map(function(str) {
    return str.toLowerCase();
  })

  return lowerCaseParts.join('_');
}

// Assumes camelCase (for now)
function getParts(token) {
  var match,
      index = 0,
      parts = [];

  var pattern = /[^A-Z][A-Z]/g;
  while (match = pattern.exec(token)) {
    parts.push(token.substring(index, match.index + 1));
    index = match.index + 1;
  }

  if (index < token.length) {
    parts.push(token.substring(index));
  }

  return parts;
}

module.exports = {
  toPascalCase: toPascalCase,
  toSnakeCase: toSnakeCase
};
