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
    self.depth    = (parent && parent.childDepth()) || 0;
    self.children = Lazy(self.rawChildren()).map(function(rawNode) {
      return self.wrapChild(rawNode);
    }).toArray();

    if (typeof self.initialize === 'function') {
      self.initialize();
    }
  };

  ctor.prototype = new Pseudocode.Node();

  Lazy(functions).each(function(f, name) {
    ctor.prototype[name] = f;
  });

  return ctor;
};

Pseudocode.Node.wrap = function(rawNode, parent) {
  if (typeof rawNode !== 'object' || typeof rawNode.type === 'undefined') {
    return rawNode;
  }

  var ctor = Pseudocode[rawNode.type];
  if (typeof ctor !== 'function') {
    Pseudocode.NodeException('Unknown node type ' + rawNode.type, rawNode);
  }
  return new ctor(rawNode, parent);
};

Pseudocode.Node.prototype.rawChildren = function() {
  return [];
};

Pseudocode.Node.prototype.childDepth = function() {
  return this.depth + 1;
};

Pseudocode.Node.prototype.wrapChild = function(rawNode) {
  return Pseudocode.Node.wrap(rawNode, this);
};

Pseudocode.Node.prototype.wrapProperties = function() {
  var self = this,
      args = Array.prototype.slice.call(arguments);

  Lazy(args).each(function(prop) {
    var propertyToWrap = self.node[prop];
    self[prop] = propertyToWrap instanceof Array ?
      new Pseudocode.NodeCollection(propertyToWrap) :
      Pseudocode.Node.wrap(propertyToWrap);
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
      self.wrapProperties(prop);
    });
  };

  ctor.prototype = new Pseudocode.Expression();

  return ctor;
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
  },

  childDepth: function() {
    return 0;
  }
});

Pseudocode.FunctionDeclaration = nodeType({
  initialize: function() {
    this.wrapProperties('id', 'params');
  },

  rawChildren: function() {
    // body is a block statement
    return [this.node.body];
  }
});

Pseudocode.BlockStatement = nodeType({
  rawChildren: function() {
    return this.node.body;
  },

  childDepth: function() {
    return this.depth;
  }
});

Pseudocode.VariableDeclaration = nodeType({
  rawChildren: function() {
    return this.node.declarations;
  },

  childDepth: function() {
    return this.depth;
  }
});

Pseudocode.VariableDeclarator = nodeType({
  initialize: function() {
    this.wrapProperties('id', 'init');
  }
});

Pseudocode.ForStatement = nodeType({
  initialize: function() {
    this.wrapProperties('init', 'test', 'update');
  },

  rawChildren: function() {
    // body is a block statement
    return [this.node.body];
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

Pseudocode.ExpressionStatement = nodeType({
  initialize: function() {
    this.wrapProperties('expression');
  }
});

Pseudocode.ReturnStatement = nodeType();

Pseudocode.Literal = exprType(['value']);

Pseudocode.Identifier = exprType(['name']);

Pseudocode.BinaryExpression = exprType(['operator', 'left', 'right']);

Pseudocode.UpdateExpression = exprType(['operator', 'argument', 'prefix']);

Pseudocode.CallExpression = exprType(['callee', 'arguments']);

Pseudocode.MemberExpression = exprType(['object', 'property', 'computed']);

Pseudocode.ArrayExpression = exprType(['elements']);

// convenience methods
function nodeType(functions) {
  return Pseudocode.Node.inherit(functions);
}

function exprType(properties) {
  return Pseudocode.Expression.inherit(properties);
}

module.exports = Pseudocode;
