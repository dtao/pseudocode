var fs = require('fs');
var Lazy = require('lazy.js');
var Pseudocode = require('../pseudocode.js');

function loadFile(filename) {
  return Pseudocode.fromJavaScript(fs.readFileSync(filename, 'utf-8')).program;
}

module.exports = {
  loadFile: loadFile
};
