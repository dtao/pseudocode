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
 * @param {object} functions A map of functions to attach to the prototype of
 *     the new node type.
 * @return {function} The constructor for the new node type.
 */
Pseudocode.Node.define = function(name, functions) {
  var ctor = function(rawNode, parent) {
    var self     = this;
    self.rawNode = rawNode;
    self.type    = rawNode && rawNode.type;
    self.parent  = parent;
    self.scope   = parent && parent.childScope() || new Pseudocode.Scope();

    var rawChildren = self.rawChildren();
    if (!(rawChildren instanceof Array)) {
      self.fail('rawChildren returned a(n) ' + typeof rawChildren +
        ' instead of an array', rawChildren);
    }

    // This might not be the best idea, but...
    self.children = Lazy(rawChildren)
      .map(function(child) { return self.wrapChild(child); })
      .toArray();

    // ...any properties that we haven't already absorbed
    // we'll now add directly.
    Lazy(rawNode).each(function(value, property) {
      if (!(property in self)) {
        self[property] = value;
      }
    });

    if (typeof self.initialize === 'function') {
      self.initialize();
    }
  };

  ctor.prototype = new Pseudocode.Node();

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
 * @return {Pseudocode.Scope} The child scope.
 */
Pseudocode.Node.prototype.childScope = function() {
  return this.scope;
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
 * Returns an array of all the identifiers belonging to the scope of this node.
 *
 * @return {Array} An array containing all of the identifiers.
 */
Pseudocode.Node.prototype.getIdentifiers = function() {
  return Lazy(this.childScope().identifiers).keys().toArray();
};

/**
 * Creates a nested array of arrays, where for each array the first element
 * identifies a type of node the subsequent elements are the node's children.
 *
 * @return {Array} The next array of arrays.
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

  if (node) {
    message += '\n\nKeys:\n' + JSON.stringify(Object.keys(node), null, 2);
    message += '\n\nNode:\n' + JSON.stringify(node, null, 2).substring(0, 1000);
  }

  throw message;
};

Lazy(astMap).each(function(selectors, name) {
  Pseudocode.Node.define(name, {
    rawChildren: function() {
      var rawNode     = this.rawNode,
          rawChildren = [];

      Lazy(selectors).each(function(selector) {
        var children = rawNode[selector];
        if (!children) {
          return;
        }

        if (!(children instanceof Array)) {
          children = [children];
        }

        rawChildren = rawChildren.concat(children);
      });

      return rawChildren;
    }
  });
});

/**
 * Represents a scoping context for identifiers.
 *
 * @constructor
 */
Pseudocode.Scope = function() {
  this.identifiers = {};
};

/**
 * Registers an identifier as belonging to the current scope.
 *
 * @param {Pseudocode.Identifier} identifier The identifier to register.
 */
Pseudocode.Scope.prototype.registerIdentifier = function(identifier) {
  this.identifiers[identifier.name] = identifier;
};

Pseudocode.Identifier.prototype.initialize = function() {
  this.scope.registerIdentifier(this);
};

module.exports = Pseudocode;
