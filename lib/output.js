global.ConsoleOutput = function() {
  this.out = function(msg, depth) {
    console.log(indent(depth) + msg);
  };
};

global.StringOutput = function() {
  var buffer = [];
  this.out = function(msg, depth) {
    buffer.push(indent(depth) + msg);
  };
  this.toString = function() {
    return buffer.join('\n');
  };
}

global.StreamOutput = function(stream) {
  this.out = function(msg, depth) {
    stream.write(indent(depth) + msg + '\n');
  };
}

function indent(depth) {
  return new Array(depth + 1).join('  ');
}
