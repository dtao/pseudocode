function ConsoleOutput() {
  this.out = function(msg, depth) {
    console.log(indent(depth) + msg);
  };
}

function StringOutput() {
  var buffer = [];
  this.out = function(msg, depth) {
    buffer.push(indent(depth) + msg);
  };
  this.toString = function() {
    return buffer.join('\n');
  };
}

function StreamOutput(stream) {
  this.out = function(msg, depth) {
    stream.write(indent(depth) + msg + '\n');
  };
}

function indent(depth) {
  return new Array(depth + 1).join('  ');
}

module.exports = {
  "Console": ConsoleOutput,
  "String": StringOutput,
  "Stream": StreamOutput
};
