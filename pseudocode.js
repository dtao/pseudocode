var fs      = require('fs');
var path    = require('path');
var esprima = require('esprima');
var Lazy    = require('lazy.js');

// For supporting multiple output mechanisms (e.g., console, string)
var outputs = require('./lib/outputs.js');

function Pseudocode(ast) {
  this.program = new Pseudocode.Program(ast);
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

function inferLanguageFromExtension(filePath) {
  switch (path.extname(filePath)) {
    case '.js':
      return 'JavaScript';

    default:
      throw 'Only JavaScript as a source language is supported right now. (And I use that word loosely.)';
  }
}

Pseudocode.Node = function() {};

Pseudocode.Node.inherit = function(functions) {
  functions = functions || {};

  var ctor = function(rawNode, parent) {
    var self      = this;
    self.node     = rawNode;
    self.parent   = parent;
    self.depth    = (parent && parent.depth + 1) || 0;
    self.children = Lazy(self.rawChildren()).map(function(rawNode) {
      return Pseudocode.Node.wrap(rawNode);
    }).toArray();

    if (typeof self.init === 'function') {
      self.init();
    }
  };

  ctor.prototype = new Pseudocode.Node();

  Lazy(functions).each(function(f, name) {
    ctor.prototype[name] = f;
  });

  return ctor;
};

Pseudocode.Node.wrap = function(rawNode) {
  var ctor = Pseudocode[rawNode.type];
  if (typeof ctor !== 'function') {
    Pseudocode.NodeException('Unknown node type ' + rawNode.Type, rawNode);
  }
  return new ctor(rawNode, this);
};

Pseudocode.Node.prototype.rawChildren = function() {
  return [];
};

Pseudocode.Node.prototype.wrap = function() {
  var self = this,
      args = Array.prototype.slice.call(arguments);

  Lazy(args).each(function(prop) {
    var propertyToWrap = self.node[prop];
    self[prop] = propertyToWrap instanceof Array ?
      new Pseudocode.NodeCollection(propertyToWrap) :
      Pseudocode.Expression.wrap(propertyToWrap);
  });
};

Pseudocode.Node.prototype.eachChild = function(fn) {
  Lazy(this.children).each(fn);
};

Pseudocode.Node.prototype.toString = function() {
  return 'Pseudocode.' + this.node.type;
};

Pseudocode.Node.prototype.output = function(output, content) {
  output.out(content, this.depth);
};

Pseudocode.Expression = nodeType();

Pseudocode.Expression.inherit = function(properties) {
  var ctor = function(rawNode, parent) {
    var self      = this;
    self.node     = rawNode;
    self.parent   = parent;

    Lazy(properties).each(function(prop) {
      self[prop] = rawNode[prop];
    });
  };

  ctor.prototype = new Pseudocode.Expression();

  return ctor;
};

Pseudocode.Expression.wrap = function(rawNode) {
  var ctor = Pseudocode[rawNode.type];
  if (typeof ctor !== 'function') {
    Pseudocode.NodeException('Unknown expression type: ' + rawNode.type, rawNode);
  }
  return new ctor(rawNode, this);
};

Pseudocode.NodeCollection = function(array) {
  this.nodes  = Lazy(array).map(Pseudocode.Node.wrap).toArray();
  this.length = this.nodes.length;
};

Pseudocode.NodeCollection.prototype.get = function(i) {
  return this.nodes[i];
};

Pseudocode.NodeCollection.prototype.each = function(fn) {
  Lazy(this.nodes).each(fn);
};

Pseudocode.NodeCollection.prototype.toString = function() {
  return 'Pseudocode.NodeCollection';
};

Pseudocode.NodeException = function(message, rawNode) {
  throw message + ':\n' +
    'Keys: ' + Object.keys(rawNode) + '\n' +
    JSON.stringify(rawNode, null, 2).substring(0, 250) + '...';
};

Pseudocode.Program = nodeType({
  rawChildren: function() {
    return this.node.body;
  }
});

Pseudocode.FunctionDeclaration = nodeType({
  init: function() {
    this.wrap('id', 'params');
  },

  rawChildren: function() {
    // body is a block statement
    return [this.node.body];
  }
});

Pseudocode.BlockStatement = nodeType({
  rawChildren: function() {
    return this.node.body;
  }
});

Pseudocode.VariableDeclaration = nodeType({
  rawChildren: function() {
    return this.node.declarations;
  }
});

Pseudocode.VariableDeclarator = nodeType({
  init: function() {
    this.wrap('id', 'init');
  }
});

Pseudocode.ForStatement = nodeType({
  rawChildren: function() {
    return this.body;
  }
});

Pseudocode.IfStatement = nodeType({
  rawChildren: function() {
    var children = [this.node.consequent];
    if (this.node.alternate) {
      children.push(this.node.alternate);
    }
    return children;
  }
});

Pseudocode.WhileStatement = nodeType({
  rawChildren: function() {
    // body is a block statement
    return [this.node.body];
  }
});

Pseudocode.ExpressionStatement = nodeType();

Pseudocode.ReturnStatement = nodeType();

Pseudocode.Identifier = exprType(['name']);

Pseudocode.CallExpression = exprType(['callee', 'arguments']);

Pseudocode.MemberExpression = exprType(['object', 'property']);

// convenience methods
function nodeType(functions) {
  return Pseudocode.Node.inherit(functions);
}

function exprType(properties) {
  return Pseudocode.Expression.inherit(properties);
}

module.exports = Pseudocode;
