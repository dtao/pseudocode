var fs       = require('fs');
var path     = require('path');
var folder   = 'samples';
var fileName = path.join(folder, 'set.js');
var js       = fs.readFileSync(fileName, 'utf-8')

var Pseudocode = require('./pseudocode.js');
var translate  = require('./lib/translate.js');
require('./lib/ruby.js');

console.log('JavaScript (original):');
console.log(js);

var pseudocode = Pseudocode.fromJavaScript(js);

console.log('');
console.log('Ruby:');
pseudocode.outputRuby();

// var rubyFileName = path.basename(fileName, path.extname(fileName))
// rubyFileName = translate.fromCamelCase(rubyFileName).toSnakeCase() + '.rb';
// pseudocode.outputRubyToFile(path.join(folder, rubyFileName));
// console.log('Saved Ruby to ' + rubyFileName);
