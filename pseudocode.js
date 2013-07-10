var fs      = require('fs');
var path    = require('path');
var esprima = require('esprima');
var Lazy    = require('lazy.js');

function ConsoleOutput() {
  this.out = function(msg, depth) {
    console.log(indent(depth) + msg);
  };
};

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

function outputRuby(node, output, depth) {
  output = output || new ConsoleOutput();

  if (typeof node.type === 'undefined') {
    // console.log('WTF? ' + JSON.stringify(node));
    return;
  }

  switch (node.type) {
    case 'Program':
      Lazy(node.body).each(function(child) {
        outputRuby(child, output, 0);
      });
      break;

    case 'BlockStatement':
      Lazy(node.body).each(function(child) {
        outputRuby(child, output, depth);
      });
      break;

    case 'BreakStatement':
      output.out('break', depth);
      break;

    case 'EmptyStatement':
      output.out('\n', 0);
      break;

    case 'ExpressionStatement':
      output.out(toRubyExpression(node.expression, depth), depth);
      break;

    case 'FunctionDeclaration':
      output.out('def ' + toRubyExpression(node.id) + toRubyParams(node.params), depth);
      outputRuby(node.body, output, depth + 1);
      output.out('end', depth);
      break;

    case 'IfStatement':
      output.out('if ' + toRubyExpression(node.test, depth), depth);
      outputRuby(node.consequent, output, depth + 1);
      if (node.alternate) {
        output.out('else', depth);
        outputRuby(node.alternate, output, depth + 1);
      }
      output.out('end', depth);
      break;

    case 'SwitchStatement':
      output.out('case ' + toRubyExpression(node.discriminant, depth), depth);
      Lazy(node.cases).each(function(child) {
        outputRuby(child, output, depth);
      });
      output.out('end', depth);
      break;

    case 'SwitchCase':
      if (node.test) {
        output.out('when ' + toRubyExpression(node.test, depth), depth);
      } else {
        output.out('else', depth);
      }
      Lazy(node.consequent).each(function(child) {
        outputRuby(child, output, depth + 1);
      });
      break;

    case 'ThrowStatement':
      if (node.argument) {
        output.out('raise ' + toRubyExpression(node.argument, depth), depth);
      } else {
        output.out('raise', depth);
      }
      break;

    case 'VariableDeclaration':
      Lazy(node.declarations).each(function(child) {
        outputRuby(child, output, depth);
      });
      break;

    case 'VariableDeclarator':
      output.out(node.id.name + ' = ' + (node.init ? toRubyExpression(node.init, depth) : 'nil'), depth);
      break;

    case 'WhileStatement':
      output.out('while ' + toRubyExpression(node.test, depth), depth);
      outputRuby(node.body, output, depth + 1);
      break;

    case 'ReturnStatement':
      if (node.argument) {
        output.out('return ' + toRubyExpression(node.argument, depth), depth);
      } else {
        output.out('return', depth);
      }
      break;

    default:
      throw 'Unknown node type: "' + node.type + '":\n' + JSON.stringify(node, null, 2).substring(0, 1000);
  }
}

function toRubyParams(params, depth, braces) {
  braces = braces || '()';
  var paramExpressions = Lazy(params).map(function(param) {
    return toRubyExpression(param, depth);
  });
  return braces.charAt(0) + paramExpressions.join(', ') + braces.charAt(1);
}

function toRubyExpression(expression, depth) {
  switch (expression.type) {
    case 'Identifier':
      return fromCamelCase(expression.name).toSnakeCase();

    case 'Literal':
      if (expression.value === 'undefined' || expression.value === 'null') {
        return 'nil';
      }
      if (typeof expression.value === 'string') {
        return '"' + expression.value.replace(/\n/g, '\\n') + '"';
      }
      return expression.value;

    case 'ArrayExpression':
      return toRubyParams(expression.elements, depth, '[]');

    case 'AssignmentExpression':
      return toRubyExpression(expression.left, depth) + ' ' + toRubyOperator(expression.operator) + ' ' + toRubyExpression(expression.right, depth);

    case 'BinaryExpression':
      return toRubyExpression(expression.left, depth) + ' ' + toRubyOperator(expression.operator) + ' ' + toRubyExpression(expression.right, depth);

    case 'CallExpression':
      return toRubyExpression(expression.callee, depth) + toRubyParams(expression.arguments, depth);

    case 'ConditionalExpression':
      return toRubyExpression(expression.test, depth) + ' ? ' +
        toRubyExpression(expression.consequent, depth) + ' : ' +
        toRubyExpression(expression.alternate, depth);

    case 'FunctionExpression':
      return toRubyLambda(expression, depth);

    case 'LogicalExpression':
      return toRubyExpression(expression.left, depth) + ' ' + toRubyOperator(expression.operator) + ' ' + toRubyExpression(expression.right, depth);

    case 'MemberExpression':
      return toRubyExpression(expression.object, depth) + '.' + toRubyExpression(expression.property, depth);

    case 'NewExpression':
      return toRubyExpression(expression.callee, depth) + '.new' + toRubyParams(expression.arguments, depth);

    case 'ThisExpression':
      return 'self';

    case 'UnaryExpression':
      return toRubyUnaryExpression(expression);

    default:
      throw 'Unknown expression type: "' + expression.type + '":\n' + JSON.stringify(expression, null, 2);
  }
}

function toRubyLambda(functionExpression, depth) {
  depth = depth || 0;

  var buffer = new StringOutput();
  buffer.out('lambda { ' + toRubyParams(functionExpression.params, depth, '||'), 0);
  outputRuby(functionExpression.body, buffer, depth + 1);
  buffer.out('}', depth);

  return buffer.toString();
}

function toRubyUnaryExpression(expression) {
  switch (expression.operator) {
    case 'typeof':
      return toRubyExpression(expression.argument) + '.class';

    default:
      return expression.operator + '(' + toRubyExpression(expression.argument) + ')';
  }
}

function toRubyOperator(operator) {
  return operator;
}

function TokenTranslator(parts) {
  this.parts = parts;
}

TokenTranslator.prototype.toSnakeCase = function() {
  var lowerCaseParts = Lazy(this.parts).map(function(str) {
    return str.toLowerCase();
  })

  return lowerCaseParts.join('_');
};

function fromCamelCase(token) {
  var match,
      index = 0,
      parts = [];

  var pattern = /[^A-Z][A-Z]/g;
  while (match = pattern.exec(token)) {
    parts.push(token.substring(index, match.index + 1));
    index = match.index + 1;
  }

  if (index < token.length - 1) {
    parts.push(token.substring(index));
  }

  return new TokenTranslator(parts);
}

var file = path.join('samples', 'binarySearch.js');
var js   = fs.readFileSync(file);
var ast  = esprima.parse(js);
var out  = path.basename(file, '.js') + '.rb'

outputRuby(ast, new StreamOutput(fs.createWriteStream(path.join('samples', out), {
  encoding: 'utf-8'
})));
