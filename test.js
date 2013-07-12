var fs = require('fs');
var js = fs.readFileSync('samples/countingSort.js', 'utf-8')

var Pseudocode = require('./pseudocode.js');
require('./lib/ruby.js');

console.log('JavaScript (original)');
console.log(js);

console.log('');
console.log('Ruby');
Pseudocode.fromJavaScript(js).outputRuby();

// console.log('');
// console.log('C#');
// Pseudocode.fromJavaScript(js).outputCSharp();
