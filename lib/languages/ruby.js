var Lazy       = require('lazy.js');
var outputs    = require('../outputs.js');
var translate  = require('../translate.js');
var Pseudocode = require('../../pseudocode.js');

Pseudocode.prototype.outputRuby = function(output) {
  output = output || new outputs.Console();
  this.program.outputRuby(output);
};

Pseudocode.prototype.outputRubyToFile = function(filePath) {
  var program = this.program;

  this.outputToFile(filePath, function(output) {
    program.outputRuby(output);
  });
};

Pseudocode.Node.prototype.outputRuby = function(output) {
  Pseudocode.NodeException(this + ' has no outputRuby method', this.node);
};

Pseudocode.Expression.prototype.toRuby = function() {
  Pseudocode.NodeException(this + ' has no toRuby method', this.node);
};

Pseudocode.Node.prototype.outputRubyEachChild = function(output) {
  this.eachChild(function(child) {
    child.outputRuby(output);
  });
};

Pseudocode.Program.prototype.outputRuby = function(output) {
  this.outputRubyEachChild(output);
};

Pseudocode.FunctionDeclaration.prototype.outputRuby = function(output) {
  this.output(output, 'def ' + this.id.toRuby() + this.params.toRubyParams());
  this.outputRubyEachChild(output);
  this.output(output, 'end');
};

Pseudocode.BlockStatement.prototype.outputRuby = function(output) {
  this.outputRubyEachChild(output);
};

Pseudocode.ExpressionStatement.prototype.outputRuby = function(output) {
  this.output(output, this.expression.toRuby());
};

Pseudocode.ForStatement.prototype.outputRuby = function(output) {
  // hacky rewrite of a for loop in Ruby:
  // we put the init on the outside and the update at the end
  this.init.adjustDepth(-1);

  this.init.outputRuby(output);
  this.output(output, 'while ' + this.test.toRuby());
  this.outputRubyEachChild(output);
  this.output(output, this.update.toRuby(), this.depth + 1);
  this.output(output, 'end');
};

Pseudocode.IfStatement.prototype.outputRuby = function(output) {
  this.output(output, 'if ' + this.test.toRuby());
  this.consequent.outputRuby(output);
  if (this.alternate) {
    this.output(output, 'else');
    this.alternate.outputRuby(output);
  }
  this.output(output, 'end');
};

Pseudocode.WhileStatement.prototype.outputRuby = function(output) {
  this.output(output, 'while ' + this.test.toRuby());
  this.outputRubyEachChild(output);
  this.output(output, 'end');
};

Pseudocode.SwitchStatement.prototype.outputRuby = function(output) {
  this.output(output, 'case ' + this.discriminant.toRuby());
  this.outputRubyEachChild(output);
  this.output(output, 'end');
};

Pseudocode.SwitchCase.prototype.outputRuby = function(output) {
  if (this.test) {
    this.output(output, 'when ' + this.test.toRuby());
  } else {
    this.output(output, 'else');
  }
  this.outputRubyEachChild(output);
};

Pseudocode.VariableDeclaration.prototype.outputRuby = function(output) {
  this.outputRubyEachChild(output);
};

Pseudocode.VariableDeclarator.prototype.outputRuby = function(output) {
  if (this.init) {
    this.output(output, this.id.toRuby() + ' = ' + this.init.toRuby());
  } else {
    this.output(output, this.id.toRuby() + ' = nil');
  }
};

Pseudocode.ReturnStatement.prototype.outputRuby = function(output) {
  if (this.argument) {
    this.output(output, 'return ' + this.argument.toRuby());
  } else {
    this.output(output, 'return');
  }
};

Pseudocode.Literal.prototype.toRuby = function() {
  if (typeof this.value === 'undefined' || this.value === null) {
    return 'nil';
  }

  switch (typeof this.value) {
    case 'string':
      return '"' + this.value + '"';

    default:
      return this.value;
  }
};

Pseudocode.Identifier.prototype.toRuby = function() {
  return translate.toSnakeCase(this.node.name);
};

Pseudocode.ArrayExpression.prototype.toRuby = function() {
  return this.elements.toRubyArray();
};

Pseudocode.ObjectExpression.prototype.toRuby = function() {
  if (this.properties.length === 0) {
    return '{}';
  } else {
    throw 'Need to implement for non-empty objects!';
  }
};

Pseudocode.FunctionExpression.prototype.toRuby = function() {
  var output = new outputs.String(this.depth);

  if (this.params.length > 0) {
    output.out('lambda { ' + this.params.toRubyList('||'), 0);
    this.body.outputRubyEachChild(output);
    output.out('}', 0);
  }

  return output.toString();
};

Pseudocode.AssignmentExpression.prototype.toRuby = function() {
  return this.left.toRuby() + ' ' + this.operator + ' ' + this.right.toRuby();
};

Pseudocode.UnaryExpression.prototype.toRuby = function() {
  if (this.operator === 'typeof') {
    return this.argument.toRuby() + '.class.name';
  }

  return this.prefix ?
    this.operator + this.argument.toRuby() :
    this.argument.toRuby() + this.operator;
};

Pseudocode.BinaryExpression.prototype.toRuby = function() {
  return this.left.toRuby() + ' '  + this.operator + ' ' + this.right.toRuby();
};

Pseudocode.ConditionalExpression.prototype.toRuby = function() {
  return this.test.toRuby() + ' ? ' + this.consequent.toRuby() + ' : ' + this.alternate.toRuby();
};

Pseudocode.LogicalExpression.prototype.toRuby = function() {
  return this.left.toRuby() + ' ' + this.operator + ' ' + this.right.toRuby();
};

Pseudocode.ThisExpression.prototype.toRuby = function() {
  return 'self';
};

Pseudocode.CallExpression.prototype.toRuby = function() {
  return this.callee.toRuby() + this.arguments.toRubyParams();
};

Pseudocode.MemberExpression.prototype.toRuby = function() {
  return this.computed ?
    this.object.toRuby() + '[' + this.property.toRuby() + ']' :
    this.object.toRuby() + '.' + this.property.toRuby();
};

Pseudocode.UpdateExpression.prototype.toRuby = function() {
  return this.prefix ?
    this.operator + this.argument.toRuby() :
    this.argument.toRuby() + this.operator;
};

Pseudocode.NodeCollection.prototype.toRubyList = function(braces) {
  return braces.charAt(0) + Lazy(this.nodes).invoke('toRuby').join(', ') + braces.charAt(1);
};

Pseudocode.NodeCollection.prototype.toRubyParams = function() {
  return this.toRubyList('()');
};

Pseudocode.NodeCollection.prototype.toRubyArray = function() {
  return this.toRubyList('[]');
};
