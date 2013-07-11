var fs      = require('fs');
var path    = require('path');
var esprima = require('esprima');

// For support multiple output mechanisms (e.g., console, string)
var outputs = require('./lib/outputs.js');

// "Supported" output languages
var ruby = require('./lib/ruby.js');

function Pseudocode(ast) {
  this.ast = ast;
}

Pseudocode.fromFile = function(filePath) {
  var lang = inferLanguageFromExtension(filePath);
  var code = fs.readFileSync(filePath);
  return Pseudocode['from' + lang](code);
};

Pseudocode.fromJavaScript = function(js) {
  var ast = esprima.parse(js);
  return new Pseudocode(ast);
};

Pseudocode.prototype.outputRuby = function(output) {
  ruby.emit(this.ast, output);
};

Pseudocode.prototype.outputRubyToFile = function(filePath) {
  var stream = fs.createWriteStream(filePath, { encoding: 'utf-8' });
  var output = new outputs.Stream(stream);
  this.outputRuby(output);
}

Pseudocode.prototype.toRuby = function() {
  var output = new outputs.String();
  this.outputRuby(output);
  return output.toString();
};

function inferLanguageFromExtension(filePath) {
  switch (path.extname(filePath)) {
    case '.js':
      return 'JavaScript';

    default:
      throw 'Only JavaScript is supported right now. (And I use that word loosely.)';
  }
}

module.exports = Pseudocode;
