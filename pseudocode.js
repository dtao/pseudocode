var fs = require('fs');
var esprima = require('esprima');
var Lazy = require('lazy.js');

function ConsoleOutput() {
  this.out = function(msg, depth) {
    console.log(indent(depth) + msg);
  };
};

function indent(depth) {
  return new Array(depth + 1).join('  ');
}

function outputRuby(node, output, depth) {
  output = output || new ConsoleOutput();

  if (typeof node.type === 'undefined') {
    console.log('WTF? ' + JSON.stringify(node));
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

    case 'ExpressionStatement':
      output.out(toRubyExpression(node.expression), depth);
      break;

    case 'FunctionDeclaration':
      output.out('def ' + node.id.name + toRubyParams(node.params), depth);
      outputRuby(node.body, output, depth + 1);
      output.out('end', depth);
      break;

    case 'IfStatement':
      output.out('if ' + toRubyExpression(node.test), depth);
      outputRuby(node.consequent, output, depth + 1);
      if (node.alternate) {
        output.out('else', depth);
        outputRuby(node.alternate, output, depth + 1);
      }
      output.out('end', depth);
      break;

    case 'VariableDeclaration':
      Lazy(node.declarations).each(function(child) {
        outputRuby(child, output, depth);
      });
      break;

    case 'VariableDeclarator':
      output.out(node.id.name + ' = ' + (node.init ? toRubyExpression(node.init) : 'nil'), depth);
      break;

    case 'WhileStatement':
      output.out('while ' + toRubyExpression(node.test), depth);
      outputRuby(node.body, output, depth + 1);
      break;

    case 'ReturnStatement':
      output.out('return ' + toRubyExpression(node.argument), depth);
      break;

    default:
      throw 'Unknown node type: "' + node.type + '":\n' + JSON.stringify(node, null, 2);
  }
}

function toRubyParams(params) {
  return '(' + Lazy(params).pluck('name').join(', ') + ')';
}

function toRubyExpression(expression) {
  switch (expression.type) {
    case 'Identifier':
      return expression.name;

    case 'Literal':
      if (expression.value === 'undefined' || expression.value === 'null') {
        return 'nil';
      }
      return expression.value;

    case 'AssignmentExpression':
      return toRubyExpression(expression.left) + ' ' + toRubyOperator(expression.operator) + ' ' + toRubyExpression(expression.right);

    case 'BinaryExpression':
      return toRubyExpression(expression.left) + ' ' + toRubyOperator(expression.operator) + ' ' + toRubyExpression(expression.right);

    case 'ConditionalExpression':
      return toRubyExpression(expression.test) + ' ? ' +
        toRubyExpression(expression.consequent) + ' : ' +
        toRubyExpression(expression.alternate);

    case 'MemberExpression':
      return toRubyExpression(expression.object) + '.' + toRubyExpression(expression.property);

    default:
      throw 'Unknown expression type: "' + expression.type + '":\n' + JSON.stringify(expression, null, 2);
  }
}

function toRubyOperator(operator) {
  return operator;
}

var binarySearchJs = fs.readFileSync('binarySearch.js');
var ast = esprima.parse(binarySearchJs);
outputRuby(ast);
