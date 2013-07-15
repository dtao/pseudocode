var Lazy       = require('lazy.js');
var outputs    = require('../outputs.js');
var translate  = require('../translate.js');
var Pseudocode = require('../../pseudocode.js');

// TODO: These first several setup methods can probably be refactored back into
// pseudocode.js, I'm thinking?
Pseudocode.prototype.outputCSharp = function(output) {
  output = output || new outputs.Console();
  this.program.outputCSharp(output);
};

Pseudocode.Node.prototype.outputCSharp = function(output) {
  Pseudocode.NodeException(this + ' has no outputCSharp method', this.node);
};

Pseudocode.Node.prototype.toCSharp = function() {
  var buffer = new outputs.String();
  this.outputCSharp(buffer);
  return buffer.toString();
};

Pseudocode.Expression.prototype.toCSharp = function() {
  Pseudocode.NodeException(this + ' has no toCSharp method', this.node);
};

Pseudocode.Node.prototype.outputCSharpEachChild = function(output) {
  this.eachChild(function(child) {
    child.outputCSharp(output);
  });
};

Pseudocode.Program.prototype.outputCSharp = function(output) {
  this.outputCSharpEachChild(output);
};

Pseudocode.BlockStatement.prototype.outputCSharp = function(output) {
  this.outputCSharpEachChild(output);
};

Pseudocode.FunctionDeclaration.prototype.outputCSharp = function(output) {
  this.output(output, 'public ' + this.returnType + ' ' + this.id.toCSharp() + this.params.toCSharpParams());
  this.output(output, '{');
  this.outputCSharpEachChild(output);
  this.output(output, '}');
};

Pseudocode.VariableDeclaration.prototype.outputCSharp = function(output) {
  this.outputCSharpEachChild(output);
};

Pseudocode.VariableDeclarator.prototype.outputCSharp = function(output) {
  if (this.init) {
    this.output(output, this.id.inferredType() + ' ' + this.id.toCSharp() + ' = ' + this.init.toCSharp() + ';');
  } else {
    this.output(output, this.id.inferredType() + ' ' + this.id.toCSharp() + ';');
  }
};

Pseudocode.IfStatement.prototype.outputCSharp = function(output) {
  this.output(output, 'if (' + this.test.toCSharp() + ')');
  this.output(output, '{');
  this.outputCSharpEachChild(output);
  this.output(output, '}');
};

Pseudocode.ForStatement.prototype.outputCSharp = function(output) {
  this.output(output, 'for (' + this.init.toCSharp() + '; ' + this.test.toCSharp() + '; ' + this.update.toCSharp() + ')');
  this.output(output, '{');
  this.outputCSharpEachChild(output);
  this.output(output, '}');
};

Pseudocode.WhileStatement.prototype.outputCSharp = function(output) {
  this.output(output, 'while (' + this.test.toCSharp() + ')');
  this.output(output, '{');
  this.outputRubyEachChild(output);
  this.output(output, '}');
};

Pseudocode.ExpressionStatement.prototype.outputCSharp = function(output) {
  this.output(output, this.expression.toCSharp());
};

Pseudocode.ReturnStatement.prototype.outputCSharp = function(output) {
  if (this.argument) {
    this.output(output, 'return ' + this.argument.toCSharp() + ';');
  } else {
    this.output(output, 'return;');
  }
};

Pseudocode.Literal.prototype.toCSharp = function() {
  if (typeof this.value === 'undefined' || this.value === null) {
    return 'null';
  }

  switch (typeof this.value) {
    case 'string':
      return '"' + this.value + '"';

    default:
      return this.value;
  }
};

Pseudocode.Identifier.prototype.toCSharp = function() {
  if (this.targetType === 'FunctionDeclaration') {
    return translate.toPascalCase(this.name);
  } else {
    return this.name;
  }
};

Pseudocode.BinaryExpression.prototype.toCSharp = function() {
  return this.left.toCSharp() + ' '  + this.operator + ' ' + this.right.toCSharp();
};

Pseudocode.UpdateExpression.prototype.toCSharp = function() {
  return this.prefix ?
    this.operator + this.argument.toCSharp() :
    this.arguments.toCSharp + this.operator;
};

Pseudocode.ConditionalExpression.prototype.toCSharp = function() {
  return this.test.toCSharp() + ' ? ' + this.consequent.toCSharp() + ' : ' + this.alternate.toCSharp();
};

Pseudocode.AssignmentExpression.prototype.toCSharp = function() {
  return this.left.toCSharp() + ' ' + this.operator + ' ' + this.right.toCSharp();
};

Pseudocode.CallExpression.prototype.toCSharp = function() {
  return this.callee.toCSharp() + this.arguments.toCSharpParams();
};

Pseudocode.MemberExpression.prototype.toCSharp = function() {
  return this.object.toCSharp() + '.' + this.property.toCSharp();
};

Pseudocode.ArrayExpression.prototype.toCSharp = function() {
  return 'new ' + this.elementType + '[] ' + this.elements.toCSharpList('{}');
};

Pseudocode.NodeCollection.prototype.toCSharpList = function(braces) {
  return braces.charAt(0) + Lazy(this.nodes).invoke('toCSharp').join(', ') + braces.charAt(1);
};

Pseudocode.NodeCollection.prototype.toCSharpParams = function() {
  return this.toCSharpList('()');
};
