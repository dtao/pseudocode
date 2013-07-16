var fs       = require('fs');
var path     = require('path');
var folder   = 'samples';
var fileName = path.join(folder, 'binarySearch.js');
var js       = fs.readFileSync(fileName, 'utf-8')

var Pseudocode = require('./pseudocode.js');
var translate  = require('./lib/translate.js');
require('./lib/languages/ruby.js');
require('./lib/languages/csharp.js');

console.log('JavaScript (original):');
console.log(js);

var pseudocode = Pseudocode.fromJavaScript(js);

console.log('');
console.log('Ruby:');
pseudocode.outputRuby();

console.log('');
console.log('C#:');
pseudocode.outputCSharp();
