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

Pseudocode.prototype.outputToFile = function(filePath, callback) {
  var stream = fs.createWriteStream(filePath, { encoding: 'utf-8' });
  callback(new outputs.Stream(stream));
  stream.end();
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
    var self    = this;
    self.node   = rawNode;
    self.type   = rawNode && rawNode.type;
    self.parent = parent;
    self.scope  = parent && parent.childScope() || self;
    self.depth  = parent && parent.childDepth() || 0;

    var rawChildren = self.rawChildren();
    if (!rawChildren) {
      Pseudocode.NodeException('rawChildren is not an array', rawNode);
    }

    self.children = Lazy(rawChildren).map(function(rawNode) {
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
  if (!rawNode || typeof rawNode !== 'object' || typeof rawNode.type === 'undefined') {
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

Pseudocode.Node.prototype.childScope = function() {
  return this.scope;
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
      new Pseudocode.NodeCollection(propertyToWrap, self) :
      Pseudocode.Node.wrap(propertyToWrap, self);
  });
};

Pseudocode.Node.prototype.eachChild = function(fn) {
  Lazy(this.children).each(fn);
};

Pseudocode.Node.prototype.eachDescendent = function(fn) {
  Lazy(this.children).each(function(child) {
    fn(child);
    child.eachDescendent(fn);
  });
};

Pseudocode.Node.prototype.adjustDepth = function(amount) {
  var self = this;

  this.depth += amount;
  this.eachDescendent(function(child) {
    child.depth = child.parent.childDepth();
  });
};

Pseudocode.Node.prototype.toString = function() {
  return 'Pseudocode.' + this.type;
};

Pseudocode.Node.prototype.output = function(output, content, depth) {
  depth = typeof depth === 'number' ? depth : this.depth;
  output.out(content, depth);
};

Pseudocode.Node.prototype.inferredType = function() {
  var cachedInferredType = this.cachedInferredType;

  if (typeof cachedInferredType === 'undefined') {
    cachedInferredType = this.inferType();

    if (cachedInferredType && this.id) {
      this.scope.inferredTypes = this.scope.inferredTypes || {};
      this.scope.inferredTypes[this.id.name] = cachedInferredType;
    }

    this.cachedInferredType = cachedInferredType;
  }

  return this.cachedInferredType;
};

Pseudocode.Node.prototype.getTypeForIdentifier = function(id) {
  if (!id.scope.inferredTypes) {
    return undefined;
  }

  var typeList = id.scope.inferredTypes[id.name];
  if (!typeList) {
    return undefined;
  }

  return typeList.length === 1 && typeList[0];
};

Pseudocode.Node.prototype.registerTypeForIdentifer = function(id, type) {
  var inferredTypes = id.scope.inferredTypes;
  if (!inferredTypes) {
    inferredTypes = id.scope.inferredTypes = {};
  }

  var typeList = inferredTypes[id.name];
  if (!typeList) {
    typeList = inferredTypes[id.name] = [];
  }

  if (arrayIndexOf(typeList, type) === -1) {
    typeList.push(type);
  }
};

Pseudocode.Expression = nodeType();

Pseudocode.Expression.inherit = function(properties) {
  var ctor = function(rawNode, parent) {
    var self    = this;
    self.node   = rawNode;
    self.type   = rawNode && rawNode.type;
    self.parent = parent;

    Lazy(properties).each(function(prop) {
      self.wrapProperties(prop);
    });

    self.dataType = self.inferType();
  };

  ctor.prototype = new Pseudocode.Expression();

  return ctor;
};

Pseudocode.Expression.prototype.inferType = function() {
  Pseudocode.NodeException(this + ' has no inferType method', this.node);
};

Pseudocode.NodeCollection = function(array, parent) {
  this.nodes = Lazy(array).map(function(node) {
    return Pseudocode.Node.wrap(node, parent);
  }).toArray();

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
    this.id.target = this;
  },

  rawChildren: function() {
    // body is a block statement
    return [this.node.body];
  },

  childScope: function() {
    return this;
  },

  inferType: function() {
    var possibleReturnTypes = [];

    this.eachDescendent(function(node) {
      if (node.type === 'ReturnStatement' && node.argument) {
        if (node.argument.inferredType()) {
          possibleReturnTypes.push(node.argument.inferredType());
        }
      }
    });

    possibleReturnTypes = Lazy(possibleReturnTypes).uniq().toArray();

    if (possibleReturnTypes.length === 1) {
      return possibleReturnTypes[0];
    }

    return false;
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
    this.registerTypeForIdentifer(this.id, this.init.dataType);
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
  initialize: function() {
    this.wrapProperties('test', 'consequent', 'alternate');
  },

  rawChildren: function() {
    var children = [this.node.consequent];
    if (this.node.alternate) {
      children.push(this.node.alternate);
    }
    return children;
  }
});

Pseudocode.WhileStatement = nodeType({
  initialize: function() {
    this.wrapProperties('test');
  },

  rawChildren: function() {
    // body is a block statement
    return [this.node.body];
  }
});

Pseudocode.SwitchStatement = nodeType({
  initialize: function() {
    this.wrapProperties('discriminant');
  },

  rawChildren: function() {
    return this.node.cases;
  },

  childDepth: function() {
    return this.depth;
  }
});

Pseudocode.SwitchCase = nodeType({
  initialize: function() {
    this.wrapProperties('test');
  },

  rawChildren: function() {
    return this.node.consequent;
  }
});

Pseudocode.ExpressionStatement = nodeType({
  initialize: function() {
    this.wrapProperties('expression');
  }
});

Pseudocode.ReturnStatement = nodeType({
  initialize: function() {
    this.wrapProperties('argument');
  }
});

Pseudocode.Literal = exprType('value');

Pseudocode.Literal.prototype.inferType = function() {
  switch (typeof this.value) {
    case 'string':
      return 'string';

    case 'number':
      return (/\./).test(this.value.toString()) ? 'double' : 'int';

    case 'boolean':
      return 'bool';

    default:
      if (this.value instanceof Array) {
        return inferArrayType(this.value);
      } else {
        return 'object';
      }
  }
}

Pseudocode.Identifier = exprType('name');

Pseudocode.Identifier.prototype.inferType = function() {
  return this.getTypeForIdentifier(this) || 'object';
};

Pseudocode.AssignmentExpression = exprType('operator', 'left', 'right');

Pseudocode.AssignmentExpression.prototype.inferType = function() {
  var type = this.init.dataType;
  if (this.left.type === 'Identifier') {
    this.registerTypeForIdentifer(this.left, type);
  }
  return type;
};

Pseudocode.UnaryExpression = exprType('operator', 'argument', 'prefix');

Pseudocode.BinaryExpression = exprType('operator', 'left', 'right');

Pseudocode.ConditionalExpression = exprType('test', 'consequent', 'alternate');

Pseudocode.LogicalExpression = exprType('operator', 'left', 'right');

Pseudocode.UpdateExpression = exprType('operator', 'argument', 'prefix');

Pseudocode.ThisExpression = exprType();

Pseudocode.CallExpression = exprType('callee', 'arguments');

Pseudocode.CallExpression.prototype.inferType = function() {
  var functionType = this.getTypeForIdentifier(this.callee);
  return functionType ? functionType.returnType : 'object';
};

Pseudocode.MemberExpression = exprType('object', 'property', 'computed');

Pseudocode.MemberExpression.prototype.inferType = function() {
  switch (this.property.name) {
    case 'count':
    case 'length':
      return 'int';

    default:
      return 'object';
  }
};

Pseudocode.ArrayExpression = exprType('elements');

Pseudocode.ObjectExpression = exprType('properties');

Pseudocode.FunctionExpression = exprType('id', 'params', 'body');

Pseudocode.FunctionExpression.prototype.inferType = function() {
  return 'object';
};

// convenience methods
function nodeType(functions) {
  return Pseudocode.Node.inherit(functions);
}

function exprType() {
  return Pseudocode.Expression.inherit(Array.prototype.slice.call(arguments));
}

function arrayIndexOf(array, element) {
  for (var i = 0; i < array.length; ++i) {
    if (array[i] === element) {
      return i;
    }
  }

  return -1;
}

module.exports = Pseudocode;
