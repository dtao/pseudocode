var Lazy = require('lazy.js');

var Generator = require('./generator.js');

function RubyGenerator(js) {
  this.source = js;
}

RubyGenerator.prototype = new Generator();

RubyGenerator.prototype.toParams = function(params, depth, braces) {
  braces = braces || '()';

  var self = this;
  var paramExpressions = Lazy(params).map(function(param) {
    return self.toExpression(param, depth);
  });
  return braces.charAt(0) + paramExpressions.join(', ') + braces.charAt(1);
};

RubyGenerator.prototype.toExpression = function(expression, depth) {
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
      return this.toParams(expression.elements, depth, '[]');

    case 'AssignmentExpression':
      return this.toExpression(expression.left, depth) + ' ' + this.toOperator(expression.operator) + ' ' + this.toExpression(expression.right, depth);

    case 'BinaryExpression':
      return this.toExpression(expression.left, depth) + ' ' + this.toOperator(expression.operator) + ' ' + this.toExpression(expression.right, depth);

    case 'CallExpression':
      return this.toExpression(expression.callee, depth) + this.toParams(expression.arguments, depth);

    case 'ConditionalExpression':
      return this.toExpression(expression.test, depth) + ' ? ' +
        this.toExpression(expression.consequent, depth) + ' : ' +
        this.toExpression(expression.alternate, depth);

    case 'FunctionExpression':
      return this.toLambda(expression, depth);

    case 'LogicalExpression':
      return this.toExpression(expression.left, depth) + ' ' + this.toOperator(expression.operator) + ' ' + this.toExpression(expression.right, depth);

    case 'MemberExpression':
      return this.toExpression(expression.object, depth) + '.' + this.toExpression(expression.property, depth);

    case 'NewExpression':
      return this.toExpression(expression.callee, depth) + '.new' + this.toParams(expression.arguments, depth);

    case 'ObjectExpression':
      return this.toHash(expression, depth);

    case 'ThisExpression':
      return 'self';

    case 'UnaryExpression':
      return this.toUnaryExpression(expression);

    default:
      throw 'Unknown expression type: "' + expression.type + '":\n' + JSON.stringify(expression, null, 2);
  }
};

RubyGenerator.prototype.toLambda = function(functionExpression, depth) {
  depth = depth || 0;

  var buffer = new StringOutput();
  buffer.out('lambda { ' + this.toParams(functionExpression.params, depth, '||'), 0);
  this.emit(functionExpression.body, buffer, depth + 1);
  buffer.out('}', depth);

  return buffer.toString();
};

RubyGenerator.prototype.toHash = function(objectExpression, depth) {
  depth = depth || 0;

  var self = this,
      buffer = new StringOutput();

  buffer.out('{', 0);
  Lazy(objectExpression.properties).each(function(property) {
    buffer.out(':' + property.key.name + ' => ' + self.toExpression(property.value, depth + 1), depth + 1);
  });
  buffer.out('}', depth);

  return buffer.toString();
}

RubyGenerator.prototype.toUnaryExpression = function(expression) {
  switch (expression.operator) {
    case 'typeof':
      return this.toExpression(expression.argument) + '.class';

    default:
      return expression.operator + '(' + this.toExpression(expression.argument) + ')';
  }
};

RubyGenerator.prototype.toOperator = function(operator) {
  return operator;
};

module.exports = RubyGenerator;
