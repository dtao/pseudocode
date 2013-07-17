var fs       = require('fs');
var path     = require('path');
var folder   = 'samples';
var fileName = path.join(folder, 'binarySearch.js');
var js       = fs.readFileSync(fileName, 'utf-8')

var Pseudocode = require('./pseudocode.js');

console.log('JavaScript (original):');
console.log(js);

var pseudocode = Pseudocode.fromJavaScript(js);

console.log('Identifiers:');
console.log(JSON.stringify(pseudocode.program.getIdentifiers(true), null, 2));
