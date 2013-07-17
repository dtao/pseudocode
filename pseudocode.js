var fs      = require('fs');
var path    = require('path');
var esprima = require('esprima');
var Lazy    = require('lazy.js');

var astMap  = require('./lib/astMap.js');

/**
 * An abstract representation of a program.
 *
 * See https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API for a
 * description of the AST format.
 *
 * @param {object} ast An abstract syntax tree conforming to Mozilla's
 *     SpiderMonkey API format (e.g., from esprima).
 * @constructor
 */
function Pseudocode(ast) {
  this.program = new Pseudocode.Program(ast);
}

Pseudocode.fromJavaScript = function(javaScript) {
  var ast = esprima.parse(javaScript);
  return new Pseudocode(ast);
};

/**
 * Wraps a node in an AST with additional functionality allowing it to access
 * its parent, references, etc. Also provides a unified interface for traversing
 * a node's children (the `children` method).
 *
 * @constructor
 */
Pseudocode.Node = function() {};

/**
 * Defines a new type of node with additional functionality.
 *
 * @param {string} name The name of the new node type.
 * @param {object=} functions An optional map of functions to attach to the
 *     prototype of the new node type.
 * @param {object=} baseType The base type for this node (defaults to Node).
 * @return {function} The constructor for the new node type.
 */
Pseudocode.Node.define = function(name, functions, baseType) {
  functions = functions || {};
  baseType = baseType || Pseudocode.Node;

  var ctor = function(rawNode, parent) {
    var self     = this;
    self.rawNode = rawNode;
    self.type    = rawNode && rawNode.type;
    self.parent  = parent;
    self.scope   = parent && parent.getChildScope() || self.createScope();

    var children = [];
    var childSelectors = self.getChildSelectors();
    Lazy(childSelectors).each(function(selector) {
      var child = rawNode[selector];
      if (!child) {
        return;
      }

      if (child instanceof Array) {
        self[selector] = Lazy(child)
          .map(function(rawChild) { return self.wrapChild(rawChild); })
          .toArray();

        children = children.concat(self[selector]);

      } else {
        self[selector] = self.wrapChild(child);
        children.push(self[selector]);
      }
    });

    self.children = children;

    Lazy(rawNode).keys().without(childSelectors).each(function(property) {
      self[property] = rawNode[property];
    });

    if (typeof self.initialize === 'function') {
      self.initialize();
    }
  };

  ctor.prototype = new baseType();

  Lazy(functions).each(function(fn, name) {
    ctor.prototype[name] = fn;
  });

  return (Pseudocode[name] = ctor);
};

/**
 * Wraps a raw AST node and sets the current node as its parent.
 *
 * @param {object} childNode The raw AST node to wrap.
 * @return {Pseudocode.Node} The wrapped node.
 */
Pseudocode.Node.prototype.wrapChild = function(childNode) {
  var ctor = Pseudocode[childNode.type];
  if (typeof ctor !== 'function') {
    this.fail('Unknown node type: ' + childNode.type, childNode);
  }
  return new ctor(childNode, this);
};

/**
 * Wraps either a value or a raw AST node.
 *
 * @param {object} property The value or raw AST node to wrap.
 * @return {*} The value or a wrapped node.
 */
Pseudocode.Node.prototype.wrapProperty = function(property) {
  if (!property || typeof property.type === 'undefined') {
    return property;
  }

  return this.wrapChild(property);
};

/**
 * Provides a scope that children belong to. By default, children share the same
 * scope as their parent.
 *
 * @return {Pseudocode.Node} The child scope.
 */
Pseudocode.Node.prototype.getChildScope = function() {
  return this.scope;
};

/**
 * Establishes this node as creating a new scope.
 *
 * @return {Pseudocode.Node} The current node.
 */
Pseudocode.Node.prototype.createScope = function() {
  this.identifiers = this.identifiers || {};
  this.identifierTypes = this.identifierTypes || {};
  return this;
};

/**
 * Returns all of the direct raw children of the current node.
 *
 * @return {Array} An array containing the raw AST child nodes.
 */
Pseudocode.Node.prototype.rawChildren = function() {
  return [];
};

/**
 * An optional callback to be invoked when a node is created.
 */
Pseudocode.Node.prototype.initialize = function() {
};

/**
 * Walks all of a node's descendents (children, grandchildren, etc.) and invokes
 * a callback for each.
 *
 * @param {function} callback The callback to invoke for each descendent.
 */
Pseudocode.Node.prototype.eachDescendent = function(callback) {
  Lazy(this.children).each(function(child) {
    if (callback(child) === false) {
      return false;
    }
    child.eachDescendent(callback);
  });
};

/**
 * Registers an identifier with the scope of the current node.
 *
 * @param {Pseudocode.Identifier} identifier The identifier to register.
 */
Pseudocode.Node.prototype.registerIdentifier = function(identifier) {
  if (!this.identifiers) {
    this.fail('no identifiers table');
  }

  this.identifiers[identifier.name] = identifier;
};

/**
 * Registers a possible data type for an identifier, based on (most likely) some
 *     heuristic.
 *
 * @param {Pseudocode.Identifier} identifier The identifier to register.
 * @param {string} dataType The name for the type for this identifier.
 */
Pseudocode.Node.prototype.registerIdentifierType = function(identifier, dataType) {
  if (!this.identifierTypes) {
    this.fail('no identifier types table');
  }

  var typeList = this.identifierTypes[identifier.name];
  if (!typeList) {
    typeList = this.identifierTypes[identifier.name] = [];
  }

  typeList.push(dataType);
};

/**
 * Returns an array of all the identifiers belonging to the scope of this node.
 *
 * @param {boolean=} recursive Whether or not to include all of the identifiers
 *     of this node and its child nodes recursively.
 * @return {object} A map of all identifiers and their types.
 */
Pseudocode.Node.prototype.getIdentifiers = function(recursive) {
  var identifiers = {};

  if (recursive) {
    this.eachDescendent(function(node) {
      if (node instanceof Pseudocode.Identifier) {
        identifiers[node.name] = { dataType: node.getDataType() };
      }
    });

  } else {
    Lazy(this.children).each(function(child) {
      if (child instanceof Pseudocode.Identifier) {
        identifiers[child.name] = { dataType: child.getDataType() };
      }
    });
  }

  return identifiers;
};

Pseudocode.Node.prototype.getDataType = function() {
  if (!this.dataType) {
    this.dataType = this.inferDataType();
  }
  return this.dataType;
};

Pseudocode.Node.prototype.inferDataType = function() {
  return 'void';
};

/**
 * Creates a nested array of arrays, where for each array the first element
 * identifies a type of node the subsequent elements are the node's children.
 *
 * @return {Array} The nested array of arrays.
 */
Pseudocode.Node.prototype.toArray = function() {
  return Lazy(this.children)
    .map(function(child) {
      var childArray = child.toArray();
      return childArray.length > 0 ?
        [child.type, childArray] :
        [child.type];
    })
    .toArray();
};

/**
 * Returns the name of this node type.
 *
 * @return {string} The name of this type of node.
 */
Pseudocode.Node.prototype.toString = function() {
  return 'Pseudocode.' + this.rawNode.type;
};

/**
 * Throws an exception with the given message and dumps a JSON representation of
 * the given raw node.
 *
 * @param {string} message The exception message.
 * @param {object=} node A raw AST node related to the exception.
 */
Pseudocode.Node.prototype.fail = function(message, node) {
  message = this + ': ' + message;

  if (node = node || this.rawNode) {
    message += '\n\nKeys:\n' + JSON.stringify(Object.keys(node), null, 2);
    message += '\n\nNode:\n' + JSON.stringify(node, null, 2).substring(0, 1000);
  }

  throw message;
};

/**
 * A type of node that evaluates to a certain data type.
 *
 * @constructor
 */
Pseudocode.Expression = function() {};

Pseudocode.Expression.prototype = new Pseudocode.Node();

Pseudocode.Expression.define = function(name, functions) {
  return Pseudocode.Node.define(name, functions, Pseudocode.Expression);
};

Pseudocode.Expression.prototype.inferDataType = function() {
  this.fail('inferDataType not implemented', this.rawNode);
};

Lazy(astMap.Statements).each(function(selectors, name) {
  Pseudocode.Node.define(name, {
    getChildSelectors: function() {
      return selectors;
    }
  });
});

Lazy(astMap.Expressions).each(function(selectors, name) {
  Pseudocode.Expression.define(name, {
    getChildSelectors: function() {
      return selectors;
    }
  });
});

Pseudocode.FunctionDeclaration.prototype.getChildScope = function() {
  return this.createScope();
};

Pseudocode.FunctionDeclaration.prototype.initialize = function() {
  this.scope.registerIdentifier(this.id);
  this.scope.registerIdentifierType(this.id, 'function');
  Lazy(this.params).each(function(param) {
    param.scope.registerIdentifier(param);
  });

  // Function declarations are a bit weird because the identifier belongs in the scope outside the
  // function, but all other children belong to the scope inside the function. (Actually makes
  // perfect sense, just doesn't lend itself to the most graceful implementation.)
  this.id.scope = this.scope;
};

Pseudocode.VariableDeclarator.prototype.initialize = function() {
  this.scope.registerIdentifier(this.id);
  if (this.init) {
    this.scope.registerIdentifierType(this.id, this.init.getDataType());
  }
};

Pseudocode.Identifier.prototype.getDataType = function() {
  return this.inferDataType();
};

Pseudocode.Identifier.prototype.inferDataType = function() {
  var possibleTypes = this.scope.identifierTypes[this.name];
  return (possibleTypes && possibleTypes.length === 1) ? possibleTypes[0] : 'object';
};

Pseudocode.Literal.prototype.inferDataType = function() {
  switch (typeof this.value) {
    case 'string': return 'string';
    case 'number': return 'int';
    case 'boolean': return 'bool';

    default:
      this.fail('Unknown literal type: ' + typeof this.value);
  }
};

Pseudocode.AssignmentExpression.prototype.inferDataType = function() {
  switch (this.operator) {
    case '=':
      return this.right.getDataType();

    default:
      this.fail('Type inference not implemented for operator ' + this.operator);
  }
};

Pseudocode.BinaryExpression.prototype.inferDataType = function() {
  switch (this.operator) {
    // TODO: implement type deduction w/ multiple possibilities
    // (i.e., this could really be a string)
    case '+':
    case '-':
      return 'int'; // or string

    case '>>':
    case '<<':
    case '>>>':
    case '<<<':
      return 'int';

    case '<':
    case '>':
    case '<=':
    case '>=':
    case '==':
      return 'bool';

    default:
      this.fail('Type inference not implemented for operator ' + this.operator);
  }
};

Pseudocode.MemberExpression.prototype.inferDataType = function() {
  return 'object';
};

Pseudocode.ConditionalExpression.prototype.inferDataType = function() {
  if (this.alternate.getDataType() === this.consequent.getDataType()) {
    return this.consequent.getDataType();
  }
  return 'object';
};

module.exports = Pseudocode;
