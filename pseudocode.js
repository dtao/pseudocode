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
 * Returns an array of all the identifiers belonging to the scope of this node.
 *
 * @param {boolean=} recursive Whether or not to include all of the identifiers
 *     of this node and its child nodes recursively.
 * @return {Array} An array containing all of the identifiers.
 */
Pseudocode.Node.prototype.getIdentifiers = function(recursive) {
  var childScope = this.getChildScope();

  if (!recursive) {
    return Lazy(childScope.identifiers).keys().toArray();
  }

  var self = this, identifiers = [];
  Lazy(childScope.identifiers).each(function(node, identifier) {
    var data = [identifier, 'object'];
    if (node.scope !== self) {
      var childIdentifiers = node.scope.getChildScope().getIdentifiers(true);
      if (childIdentifiers.length > 0) {
        data.push(childIdentifiers);
      }
    }
    identifiers.push(data);
  });

  return identifiers;
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

  if (node) {
    message += '\n\nKeys:\n' + JSON.stringify(Object.keys(node), null, 2);
    message += '\n\nNode:\n' + JSON.stringify(node, null, 2).substring(0, 1000);
  }

  throw message;
};

Lazy(astMap).each(function(selectors, name) {
  Pseudocode.Node.define(name, {
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
  Lazy(this.params).each(function(param) {
    param.scope.registerIdentifier(param);
  });
};

module.exports = Pseudocode;
