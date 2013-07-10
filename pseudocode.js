var fs   = require('fs');
var path = require('path');

var RubyGenerator = require('./lib/generators/rubyGenerator.js');

// Pick a file, any file.
var file       = path.join('samples', 'binarySearch.js');
var js         = fs.readFileSync(file);
var generator  = new RubyGenerator(js);
var outputFile = path.basename(file, '.js') + '.rb';

generator.generate(new StreamOutput(fs.createWriteStream(path.join('samples', outputFile), {
  encoding: 'utf-8'
})));
