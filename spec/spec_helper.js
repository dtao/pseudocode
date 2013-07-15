var fs = require('fs');
var Pseudocode = require('../pseudocode.js');

function loadFile(filename) {
  return Pseudocode.fromJavaScript(fs.readFileSync(filename, 'utf-8'));
}

global.loadFile = loadFile;
