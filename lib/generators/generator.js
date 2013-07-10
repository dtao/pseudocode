var esprima = require('esprima');
var Lazy    = require('lazy.js');

require('../output.js');
require('../tokenTranslator.js');

function Generator(js) {
  this.source = js;
}

Generator.prototype.generate = function(output) {
  output = output || new ConsoleOutput();

  var ast = esprima.parse(this.source);
  this.emit(ast, output);
};

Generator.prototype.emit = function(node, output, depth) {
  depth = depth || 0;

  var self = this;

  switch (node.type) {
    case 'Program':
      Lazy(node.body).each(function(child) {
        self.emit(child, output, 0);
      });
      break;

    case 'BlockStatement':
      Lazy(node.body).each(function(child) {
        self.emit(child, output, depth);
      });
      break;

    case 'BreakStatement':
      output.out('break', depth);
      break;

    case 'EmptyStatement':
      output.out('\n', 0);
      break;

    case 'ExpressionStatement':
      output.out(self.toExpression(node.expression, depth), depth);
      break;

    case 'FunctionDeclaration':
      output.out('def ' + self.toExpression(node.id) + self.toParams(node.params), depth);
      self.emit(node.body, output, depth + 1);
      output.out('end', depth);
      break;

    case 'IfStatement':
      output.out('if ' + self.toExpression(node.test, depth), depth);
      self.emit(node.consequent, output, depth + 1);
      if (node.alternate) {
        output.out('else', depth);
        self.emit(node.alternate, output, depth + 1);
      }
      output.out('end', depth);
      break;

    case 'SwitchStatement':
      output.out('case ' + self.toExpression(node.discriminant, depth), depth);
      Lazy(node.cases).each(function(child) {
        self.emit(child, output, depth);
      });
      output.out('end', depth);
      break;

    case 'SwitchCase':
      if (node.test) {
        output.out('when ' + self.toExpression(node.test, depth), depth);
      } else {
        output.out('else', depth);
      }
      Lazy(node.consequent).each(function(child) {
        self.emit(child, output, depth + 1);
      });
      break;

    case 'ThrowStatement':
      if (node.argument) {
        output.out('raise ' + self.toExpression(node.argument, depth), depth);
      } else {
        output.out('raise', depth);
      }
      break;

    case 'VariableDeclaration':
      Lazy(node.declarations).each(function(child) {
        self.emit(child, output, depth);
      });
      break;

    case 'VariableDeclarator':
      output.out(node.id.name + ' = ' + (node.init ? self.toExpression(node.init, depth) : 'nil'), depth);
      break;

    case 'WhileStatement':
      output.out('while ' + self.toExpression(node.test, depth), depth);
      self.emit(node.body, output, depth + 1);
      break;

    case 'ReturnStatement':
      if (node.argument) {
        output.out('return ' + self.toExpression(node.argument, depth), depth);
      } else {
        output.out('return', depth);
      }
      break;

    default:
      throw 'Unknown node type: "' + node.type + '":\n' + JSON.stringify(node, null, 2).substring(0, 1000);
  }
}

module.exports = Generator;
