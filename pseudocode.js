(function(root) {
  var esprima, Lazy;

  if (typeof require === 'function') {
    esprima = require('esprima');
    Lazy    = require('lazy.js');

  } else {
    esprima = root.esprima;
    Lazy    = root.Lazy;
  }

  if (typeof esprima === 'undefined') {
    throw 'Unable to load esprima.js';
  }

  if (typeof Lazy === 'undefined') {
    throw 'Unable to load Lazy.js';
  }

  var anonymousFunctionIndex = 1;

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
      self.program = parent && parent.program || self;

      if (typeof self.initialize === 'function') {
        self.initialize();
      }

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

      if (typeof self.finalize === 'function') {
        self.finalize();
      }

      self.getDataType();
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
  Pseudocode.Node.prototype.finalize = function() {
  };

  /**
   * Iterates over all the nodes in the current node's scope, without descending
   * into nested scopes.
   *
   * @param {function} callback The callback to invoke for each node.
   * @param {Pseudocode.Node=} scope The scope to iterate in (defaults to this
   *     node's scope).
   * @param {string=} type The type of node to restrict results to.
   */
  Pseudocode.Node.prototype.eachChildInScope = function(callback, scope, type) {
    scope = scope || this.getChildScope();

    Lazy(this.children).each(function(child) {
      if (child.scope !== scope) {
        return;
      }
      if ((!type || child.type === type) && callback(child) === false) {
        return false;
      }
      if (child.getChildScope() === scope) {
        child.eachChildInScope(callback, scope, type);
      }
    });
  };

  /**
   * Walks all of a node's descendents (children, grandchildren, etc.) and invokes
   * a callback for each.
   *
   * @param {function} callback The callback to invoke for each descendent.
   * @param {string=} type The type of node restrict results to.
   */
  Pseudocode.Node.prototype.eachDescendent = function(callback, type) {
    Lazy(this.children).each(function(child) {
      if ((!type || child.type === type) && callback(child) === false) {
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

    if (!identifier) {
      this.fail('cannot register a null identifier');
    }

    // TODO: This is totally not cool. Probably I should update the nodeTypes
    // map to include the properties of each node; then 'name' and so forth can
    // be attached to the necessary prototype as methods.
    this.identifiers[identifier.name || identifier.rawNode.name] = identifier;
  };

  /**
   * Registers a possible data type for an identifier, based on (most likely) some
   *     heuristic.
   *
   * @param {Pseudocode.Identifier} identifier The identifier to register.
   * @param {object} dataType The name, type, or array of names, for the type
   *     for this identifier.
   */
  Pseudocode.Node.prototype.registerIdentifierType = function(identifier, dataType) {
    if (!this.identifierTypes) {
      this.fail('no identifier types table');
    }

    if (!dataType) {
      this.fail('invalid data type: ' + dataType);
    }

    if (dataType === 'object') {
      return false;
    }

    if (dataType instanceof Array) {
      dataType = new Pseudocode.AmbiguousType(dataType);
    }

    var typeList = this.identifierTypes[identifier.name];
    if (!typeList) {
      typeList = this.identifierTypes[identifier.name] = new Pseudocode.SetList();
    }

    if (typeList.length === 1) {
      switch (Pseudocode.compareTypes(dataType, typeList.get(0))) {
        case 1:
          this.clearTypesForIdentifier(identifier);
          break;

        case -1:
          return false;
      }
    }

    return typeList.push(dataType);
  };

  /**
   * Registers a possible return type for a function.
   *
   * @param {Pseudocode.Identifier} identifier The identifier of the function.
   * @param {string=} returnType The name of the return type.
   */
  Pseudocode.Node.prototype.registerFunctionReturnType = function(identifier, returnType) {
    var returnType = returnType ?
      new Pseudocode.FunctionType(returnType) : 'function';

    return this.registerIdentifierType(identifier, returnType);
  };

  /**
   * Registers a possible collection type (e.g., array, list) and element type for
   * a collection.
   *
   * @param {Pseudocode.Identifier} identifier The identifier of the collection.
   * @param {string=} options.collectionType The name of the collection type.
   * @param {string=} options.elementType The name of the element type.
   */
  Pseudocode.Node.prototype.registerCollectionType = function(identifier, options) {
    if (this.getTypeForIdentifier(identifier) === 'array') {
      this.clearTypesForIdentifier(identifier);
    }

    var collectionType = options.elementType ?
      new Pseudocode.CollectionType(options.elementType, options.collectionType) : 'array';

    return this.registerIdentifierType(identifier, collectionType);
  };

  /**
   * Gets the known data type (if available) for the given identifier. Only
   * returns a result when it is unambiguous (i.e., when there is exactly one
   * possible type for the identifier).
   *
   * @param {Pseudocode.Identifier} identifier The identifier to look up.
   * @return {string} The known data type for the identifier, if available.
   */
  Pseudocode.Node.prototype.getTypeForIdentifier = function(identifier) {
    var scope = this;

    var typeList = scope.identifierTypes[identifier.name];

    while (typeof typeList === 'undefined') {
      scope = scope.scope;
      typeList = scope.identifierTypes[identifier.name];

      if (scope === scope.scope) {
        break;
      }
    }

    return typeList && (typeList.length === 1 ? typeList.get(0) : typeList.toArray());
  };

  /**
   * Clears registered types for the given identifier.
   *
   * @param {Pseudocode.Identifier} identifier The identifier to clear.
   */
  Pseudocode.Node.prototype.clearTypesForIdentifier = function(identifier) {
    var typeList = this.identifierTypes[identifier.name];
    if (typeList) {
      typeList.clear();
    }
  };

  /**
   * Gets a specific identifier in the program.
   *
   * @param {string} name The name of the identifier.
   * @return {object} The identifier.
   */
  Pseudocode.Node.prototype.getIdentifier = function(name) {
    if (!this.identifiers) {
      this.fail('no identifiers table');
    }

    return this.identifiers[name];
  };

  /**
   * Gets all the identifiers within the scope of this node.
   *
   * @param {boolean=} recursive Whether or not to include all of the identifiers
   *     of this node and its child nodes recursively.
   * @return {object} A map of all identifiers and their types.
   */
  Pseudocode.Node.prototype.getIdentifiers = function(recursive) {
    var scope = this.getChildScope(),
        identifiers = {};

    this.eachChildInScope(function(child) {
      var data = {};

      if (child instanceof Pseudocode.FunctionDeclaration || child instanceof Pseudocode.FunctionExpression) {
        data = identifiers[child.id.name] = { dataType: child.id.getDataType() };

      } else if (child instanceof Pseudocode.Identifier) {
        if (child.isDefinedHere()) {
          data = identifiers[child.name] = { dataType: child.getDataType() };
        }
      }

      if (recursive && child.getChildScope() !== scope) {
        data.identifiers = child.getIdentifiers(true);
      }
    });

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

  Pseudocode.Node.prototype.isFunction = function() {
    return this instanceof Pseudocode.FunctionDeclaration ||
      this instanceof Pseudocode.FunctionExpression;
  };

  Pseudocode.Node.prototype.isFunctionType = function() {
    var dataType = this.getDataType();
    return dataType === 'function' || dataType instanceof Pseudocode.FunctionType;
  };

  Pseudocode.Node.prototype.isCollectionType = function() {
    var dataType = this.getDataType();
    return dataType === 'array' || dataType instanceof Pseudocode.CollectionType;
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
    return this.id ?
      this.id.name + ': Pseudocode.' + this.rawNode.type :
      'Pseudocode.' + this.rawNode.type;
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

    throw new Error(message);
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

  /**
   * Basically says 'I believe the expression is of type T', which might be useful
   * in any number of ways.
   *
   * @param {object} dataType The probable data type, or array of probable
   *     types, for the expression.
   */
  Pseudocode.Expression.prototype.probableDataType = function(dataType) {
    if (dataType instanceof Array) {
      dataType = new Pseudocode.AmbiguousType(dataType);
    }
    if (this instanceof Pseudocode.Identifier) {
      return this.registerDataType(dataType);
    }
    if (this instanceof Pseudocode.MemberExpression && this.object instanceof Pseudocode.Identifier) {
      if (this.computed && this.property.getDataType() === 'int') {
        return this.object.definingScope().registerCollectionType(this.object, {
          elementType: dataType
        });
      }
    }
    return false;
  };

  /**
   * An expandable list of strings without duplicates.
   *
   * @constructor
   */
  Pseudocode.SetList = function() {
    this.clear();
  };

  /**
   * Clears the list of all elements.
   */
  Pseudocode.SetList.prototype.clear = function() {
    this.set    = {};
    this.list   = [];
    this.length = 0;
  };

  /**
   * Adds a string to the list if it isn't already present.
   *
   * @param {string} value The value to add to the list.
   * @return {boolean} True if the value was added, or false if it was already
   *     present.
   */
  Pseudocode.SetList.prototype.push = function(value) {
    if (!this.set[value]) {
      this.set[value] = true;
      this.list.push(value);
      ++this.length;
      return true;
    }

    return false;
  };

  /**
   * Gets the nth value in the list.
   *
   * @param {number} n The index of the value to retrieve.
   * @return {string} The value at the nth position in the list.
   */
  Pseudocode.SetList.prototype.get = function(n) {
    return this.list[n];
  };

  /**
   * Returns an array (copy) of the values in the set.
   *
   * @return {array} An array containing the values in the set.
   */
  Pseudocode.SetList.prototype.toArray = function() {
    return this.list.slice(0);
  };

  /**
   * Returns a string concatenating all of the values in the list together with
   * the specified delimiter.
   *
   * @param {string} delimiter The character(s) used to separate values in the
   *     resulting string.
   * @return {string} The concatenated string.
   */
  Pseudocode.SetList.prototype.join = function(delimiter) {
    return this.list.join(delimiter);
  };

  /**
   * Serves as an abstract base for data types.
   */
  Pseudocode.Type = function() {};

  /**
   * Represents a function along with its return type.
   *
   * @param {string} returnType The return type of the function.
   * @constructor
   */
  Pseudocode.FunctionType = function(returnType) {
    if (returnType instanceof Array) {
      returnType = new Pseudocode.AmbiguousType(returnType);
    }

    this.functionType = 'function';
    this.returnType = returnType;
  };

  Pseudocode.FunctionType.prototype = new Pseudocode.Type();

  Pseudocode.FunctionType.prototype.compareTo = function(other) {
    if (other === 'function') {
      return 1;
    }
    if (!(other instanceof Pseudocode.FunctionType)) {
      return 0;
    }
    return Pseudocode.compareTypes(this.returnType, other.returnType);
  };

  Pseudocode.FunctionType.prototype.toString = function() {
    return this.returnType && this.returnType !== 'void' ?
      'func<' + this.returnType + '>' :
      'function';
  };

  /**
   * Represents a collection along with the type of elements it contains.
   *
   * @param {string} collectionType The type of collection.
   * @param {string} elementType The type of elements in the collection.
   * @constructor
   */
  Pseudocode.CollectionType = function(elementType, collectionType) {
    if (elementType instanceof Array) {
      elementType = new Pseudocode.AmbiguousType(elementType);
    }

    this.collectionType = collectionType || 'array';
    this.elementType = elementType;
  };

  Pseudocode.CollectionType.prototype = new Pseudocode.Type();

  Pseudocode.CollectionType.prototype.compareTo = function(other) {
    if (other === 'array') {
      return 1;
    }
    if (!(other instanceof Pseudocode.CollectionType)) {
      return 0;
    }
    return Pseudocode.compareTypes(this.elementType, other.elementType);
  };

  Pseudocode.CollectionType.prototype.toString = function() {
    return this.elementType ?
      this.collectionType + '<' + this.elementType + '>' :
      this.collectionType;
  };

  /**
   * Represents a set of more than one possible type for an expression (e.g.,
   * either an int or a string).
   *
   * @param {Array} options
   * @constructor
   */
  Pseudocode.AmbiguousType = function(options) {
    this.options = options;
  };

  Pseudocode.AmbiguousType.prototype = new Pseudocode.Type();

  Pseudocode.AmbiguousType.prototype.compareTo = function(other) {
    if (typeof other === 'string') {
      return arrayContains(this.options, other) ? -1 : 0;
    }
    if (other instanceof Pseudocode.AmbiguousType) {
      return this.compareToAmbiguousType(other);
    }
    return 0;
  };

  Pseudocode.AmbiguousType.prototype.compareToAmbiguousType = function(other) {
    var intersection = Lazy(this.options).intersection(other.options).toArray();
    if (intersection.length === this.options.length) {
      if (other.options.length > this.options.length) {
        // this is a subset of other
        return 1;

      } else {
        // this and other have the same options
        return 0;
      }

    } else if (intersection.length === other.options.length) {
      // other is a subset of this
      return -1;
    }

    // this and other each has element(s) the other doesn't have
    return 0;
  };

  Pseudocode.AmbiguousType.prototype.toString = function() {
    return this.options.join('|');
  };

  var nodeTypes = {
    Statements: {
      'Program': ['body'],
      'BlockStatement': ['body'],
      'FunctionDeclaration': ['id', 'params', 'body'],
      'VariableDeclaration': ['declarations'],
      'VariableDeclarator': ['id', 'init'],
      'ExpressionStatement': ['expression'],
      'IfStatement': ['test', 'consequent', 'alternate'],
      'WhileStatement': ['test', 'body'],
      'ForStatement': ['init', 'test', 'update', 'body'],
      'SwitchStatement': ['discriminant', 'cases'],
      'SwitchCase': ['test', 'consequent'],
      'TryStatement': ['block', 'handlers', 'finalizer'],
      'CatchClause': ['param', 'body'],
      'EmptyStatement': [],
      'ReturnStatement': ['argument'],
    },

    Expressions: {
      'Identifier': [],
      'Literal': [],
      'Property': ['key', 'value'],
      'ThisExpression': [],
      'AssignmentExpression': ['left', 'right'],
      'UnaryExpression': ['argument'],
      'BinaryExpression': ['left', 'right'],
      'LogicalExpression': ['left', 'right'],
      'ConditionalExpression': ['test', 'consequent', 'alternate'],
      'UpdateExpression': ['argument'],
      'MemberExpression': ['object', 'property'],
      'CallExpression': ['callee', 'arguments'],
      'ArrayExpression': ['elements'],
      'ObjectExpression': ['properties'],
      'Property': ['key', 'value'],
      'FunctionExpression': ['id', 'params', 'body']
    }
  };

  var familiarMethods = [
    ['string', ['charAt', 'substr', 'substring', 'toLowerCase', 'toUpperCase']],
  ];

  var methodLookup = Lazy(familiarMethods).reduce(function(lookup, methodList) {
    var type = methodList[0];
    var methods = methodList[1];

    Lazy(methods).each(function(method) {
      lookup[method] = type;
    });

    return lookup;
  }, {});

  Lazy(nodeTypes.Statements).each(function(selectors, name) {
    Pseudocode.Node.define(name, {
      getChildSelectors: function() {
        return selectors;
      }
    });
  });

  Lazy(nodeTypes.Expressions).each(function(selectors, name) {
    Pseudocode.Expression.define(name, {
      getChildSelectors: function() {
        return selectors;
      }
    });
  });

  Pseudocode.Program.prototype.initialize = function() {
    this.allIdentifiers = {};
  };

  Pseudocode.Program.prototype.finalize = function() {
    var typesInferred;

    do {
      typesInferred = 0;

      this.eachDescendent(function(node) {
        var registeredType, inferredDataType;

        if (node instanceof Pseudocode.VariableDeclarator && node.init) {
          registeredType = node.id.getDataType();
          inferredDataType = node.init.inferDataType();
          switch (Pseudocode.compareTypes(registeredType, inferredDataType)) {
            case -1:
              if (node.id.registerDataType(inferredDataType)) {
                ++typesInferred;
              }
              return;

            case 1:
              if (node.init.probableDataType(registeredType)) {
                ++typesInferred;
              }
              return;
          }
        }

        if (node instanceof Pseudocode.AssignmentExpression && node.left instanceof Pseudocode.Identifier) {
          registeredType = node.left.getDataType();
          inferredDataType = node.right.inferDataType();
          if (!Pseudocode.typesAreEqual(registeredType, inferredDataType)) {
            if (node.left.registerDataType(inferredDataType)) {
              ++typesInferred;
            }
            return;
          }
        }

        if (node.isFunction()) {
          registeredType = node.id.getDataType();
          inferredDataType = node.inferDataType();
          if (!Pseudocode.typesAreEqual(registeredType, inferredDataType)) {
            if (node.id.registerDataType(inferredDataType)) {
              ++typesInferred;
            }
            return;
          }
        }
      });

    } while (typesInferred > 0);
  };

  // Intended to be used as a mix-in for FunctionDeclaration and FunctionExpression types
  Pseudocode.Functional = {};

  Pseudocode.Functional.getChildScope = function() {
    return this.createScope();
  };

  Pseudocode.Functional.finalize = function() {
    // Function declarations are a bit weird because the identifier belongs in the scope outside the
    // function, but all other children belong to the scope inside the function. (Actually makes
    // perfect sense, just doesn't lend itself to the most graceful implementation.)
    if (this.id) {
      this.id.scope = this.scope;
    }
  };

  Pseudocode.Functional.inferDataType = function() {
    var self = this,
        returnTypes = new Pseudocode.SetList();

    self.eachChildInScope(function(node) {
      if (!(node instanceof Pseudocode.ReturnStatement)) {
        return;
      }

      var returnType = node.argument ? node.argument.getDataType() : 'void';
      if (self.id) {
        self.scope.registerFunctionReturnType(self.id, returnType);
      }
      returnTypes.push(returnType);
    });

    if (returnTypes.length === 0) {
      if (self.id) {
        self.scope.registerFunctionReturnType(self.id, 'void');
      }
      returnTypes.push('void');
    }

    var returnType = returnTypes.length === 1 ? returnTypes.get(0) : 'object';

    return new Pseudocode.FunctionType(returnType);
  };

  Pseudocode.Functional.extend = function(type) {
    for (var method in Pseudocode.Functional) {
      if (method !== 'extend') {
        type.prototype[method] = Pseudocode.Functional[method];
      }
    }
  };

  Pseudocode.Functional.extend(Pseudocode.FunctionDeclaration);

  Pseudocode.VariableDeclarator.prototype.finalize = function() {
    this.scope.registerIdentifier(this.id);
    if (this.init) {
      this.scope.registerIdentifierType(this.id, this.init.getDataType());
    }
  };

  Pseudocode.Identifier.prototype.initialize = function() {
    if (this.parent && this.parent.isFunction()) {
      if (this.rawNode === this.parent.rawNode.id) {
        this.parent.scope.registerIdentifier(this);
      } else {
        this.scope.registerIdentifier(this);
      }
    }

    if (this.parent instanceof Pseudocode.VariableDeclarator) {
      this.scope.registerIdentifier(this);
    }
  };

  Pseudocode.Identifier.prototype.finalize = function() {
    var data = this.program.allIdentifiers[this.name] || { scopes: [] };
    data.scopes.push('' + this.scope);
    this.program.allIdentifiers[this.name] = data;
  };

  Pseudocode.Identifier.prototype.getDataType = function() {
    return this.inferDataType();
  };

  Pseudocode.Identifier.prototype.inferDataType = function() {
    return this.definingScope().getTypeForIdentifier(this) || 'object';
  };

  Pseudocode.Identifier.prototype.isDefinedHere = function() {
    if (this.parent instanceof Pseudocode.FunctionDeclaration) {
      return true;
    }

    if (this.parent instanceof Pseudocode.FunctionExpression) {
      return true;
    }

    if (this.parent instanceof Pseudocode.VariableDeclarator) {
      if (this === this.parent.id) {
        return true;
      }
    }

    return false;
  };

  Pseudocode.Identifier.prototype.definingScope = function() {
    var scope = this.scope;
    while (!scope.identifiers[this.name] && !(scope instanceof Pseudocode.Program)) {
      scope = scope.scope;
    }
    return scope;
  };

  Pseudocode.Identifier.prototype.registerDataType = function(dataType) {
    return this.definingScope().registerIdentifierType(this, dataType);
  };

  Pseudocode.Identifier.prototype.toString = function() {
    return this.type + ' "' + this.name + '"';
  };

  Pseudocode.Literal.prototype.inferDataType = function() {
    switch (typeof this.value) {
      case 'string': return 'string';
      case 'number': return 'int';
      case 'boolean': return 'bool';
      case 'object': return 'object';

      default:
        this.fail('Unknown literal type: ' + typeof this.value);
    }
  };

  Pseudocode.Property.prototype.inferDataType = function() {
    return this.value.inferDataType();
  };

  Pseudocode.ThisExpression.prototype.inferDataType = function() {
    return this.scope.getDataType();
  };

  Pseudocode.AssignmentExpression.prototype.finalize = function() {
    switch (this.operator) {
      // These operators only make sense for integers.
      case '-=':
      case '*=':
      case '/=':
        this.left.probableDataType('int');
        this.right.probableDataType('int');
        break;

      default:
        switch (Pseudocode.compareTypes(this.left.getDataType(), this.right.getDataType())) {
          case 1:
            this.right.probableDataType(this.left.getDataType());
            break;

          case -1:
            this.left.probableDataType(this.right.getDataType());
            break;
        }
    }
  };

  Pseudocode.AssignmentExpression.prototype.inferDataType = function() {
    switch (this.operator) {
      case '+=':
        return new Pseudocode.AmbiguousType(['int', 'string']);

      case '-=':
      case '*=':
      case '/=':
        return 'int';

      case '=':
        return this.right.getDataType();

      default:
        this.fail('Type inference not implemented for operator ' + this.operator);
    }
  };

  Pseudocode.UnaryExpression.prototype.inferDataType = function() {
    switch (this.operator) {
      case 'typeof':
        return 'string';

      case '!':
        return 'bool';

      case '-':
      case '+':
        return 'int';

      default:
        this.fail('Type inference not implemented for operator ' + this.operator);
    }
  };

  Pseudocode.BinaryExpression.prototype.finalize = function() {
    switch (this.operator) {
      case '+':
      case '<':
      case '>':
      case '<=':
      case '>=':
        if (this.left.getDataType() === 'int' || this.left.getDataType() === 'string') {
          this.right.probableDataType(this.left.getDataType());

        } else if (this.right.getDataType() === 'int' || this.right.getDataType() === 'string') {
          this.left.probableDataType(this.right.getDataType());

        } else {
          this.left.probableDataType(['int', 'string']);
          this.right.probableDataType(['int', 'string']);
        }
        break;

      case '-':
      case '*':
      case '/':
      case '%':
      case '>>':
      case '<<':
      case '>>>':
      case '<<<':
        this.left.probableDataType('int');
        this.right.probableDataType('int');
        break;
    }
  };

  Pseudocode.BinaryExpression.prototype.inferDataType = function() {
    switch (this.operator) {
      case '+':
        if (this.left.getDataType() === 'int' && this.right.getDataType() === 'int') {
          return 'int';
        } else if (this.left.getDataType() === 'string' && this.right.getDataType() === 'string') {
          return 'string';
        }
        return new Pseudocode.AmbiguousType(['int', 'string']);

      case '-':
      case '*':
      case '/':
      case '%':
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
      case '!=':
      case '===':
      case '!==':
      case 'instanceof':
        return 'bool';

      default:
        this.fail('Type inference not implemented for operator ' + this.operator);
    }
  };

  Pseudocode.LogicalExpression.prototype.inferDataType = function() {
    return this.right.getDataType();
  };

  Pseudocode.ConditionalExpression.prototype.inferDataType = function() {
    if (this.alternate.getDataType() === this.consequent.getDataType()) {
      return this.consequent.getDataType();
    }
    return 'object';
  };

  Pseudocode.UpdateExpression.prototype.finalize = function() {
    switch (this.operator) {
      case '--':
      case '++':
        this.argument.probableDataType('int');
        break;
    }
  };

  Pseudocode.UpdateExpression.prototype.inferDataType = function() {
    switch (this.operator) {
      case '--':
      case '++':
        return 'int';

      default:
        this.fail('Type inference not implemented for operator ' + this.operator);
    }
  };

  Pseudocode.MemberExpression.prototype.finalize = function() {
    if (this.object instanceof Pseudocode.Identifier) {
      if (this.computed && this.property.getDataType() === 'int') {
        this.scope.registerIdentifierType(this.object, 'array');
      }
    }
  };

  Pseudocode.MemberExpression.prototype.inferDataType = function() {
    switch (this.property.name) {
      case 'count':
      case 'length':
      case 'size':
        return 'int';

      default:
        return 'object';
    }
  };

  Pseudocode.CallExpression.prototype.finalize = function() {
    // TODO: Refactor this into something actually sensible.
    // For now, this is just a POC to demonstrate that we could infer the element
    // type for a collection based on what is passed to #push.
    if (!(this.callee instanceof Pseudocode.MemberExpression)) {
      return;
    }
    if (this.arguments.length !== 1) {
      return;
    }
    if (!(this.callee.object instanceof Pseudocode.Identifier)) {
      return;
    }
    if (!(this.callee.property instanceof Pseudocode.Identifier)) {
      return;
    }
    if (this.callee.object.isCollectionType() && this.callee.property.name === 'push') {
      this.callee.object.definingScope().registerCollectionType(this.callee.object, {
        collectionType: 'list',
        elementType: this.arguments[0].getDataType()
      });
    } else if (methodLookup[this.callee.property.name]) {
      this.callee.object.registerDataType(methodLookup[this.callee.property.name]);
    }
  };

  Pseudocode.CallExpression.prototype.inferDataType = function() {
    var functionType = this.callee.getDataType();
    return functionType.returnType || 'object';
  };

  Pseudocode.ArrayExpression.prototype.inferDataType = function() {
    var elementTypes = Lazy(this.elements)
      .map(function(node) { return node.getDataType() })
      .toArray();

    if (uniqueTypes(elementTypes).length === 1) {
      return new Pseudocode.CollectionType(elementTypes[0]);
    }

    return 'array';
  };

  Pseudocode.ObjectExpression.prototype.inferDataType = function() {
    return 'object';
  };

  Pseudocode.Property.prototype.inferDataType = function() {
    return this.value.getDataType();
  };

  Pseudocode.Functional.extend(Pseudocode.FunctionExpression);

  Pseudocode.FunctionExpression.prototype.finalize = function() {
    Pseudocode.Functional.finalize.call(this);

    // For anonymous functions...
    if (!this.id) {
      // If this is part of a statement like:
      // var f = function() {}
      if (this.parent instanceof Pseudocode.VariableDeclarator) {
        // ...then we'll set the variable name as this function's ID.
        this.id = this.parent.id;

      } else {
        // Otherwise, let's just say it's anonymous.
        this.id = this.wrapChild({
          type: 'Identifier',
          name: getAnonymousFunctionName()
        });
      }
    }
  };

  function getAnonymousFunctionName() {
    return '(anonymous ' + (anonymousFunctionIndex++) + ')';
  }

  function arrayContains(array, element) {
    for (var i = 0; i < array.length; ++i) {
      if (array[i] === element) {
        return true;
      }
    }
  }

  function uniqueTypes(types) {
    var names  = [],
        result = [];

    for (var i = 0; i < types.length; ++i) {
      if (!arrayContains(names, String(types[i]))) {
        names.push(String(types[i]));
        result.push(types[i]);
      }
    }

    return result;
  }

  // These would be private functions, but I want to expose them to specs.

  Pseudocode.typesAreEqual = function(x, y) {
    if (typeof x !== typeof y) {
      return false;
    }
    return String(x) === String(y);
  };

  Pseudocode.compareTypes = function(left, right) {
    if (left === 'object' && right !== 'object') {
      return -1;
    }
    if (left !== 'object' && right === 'object') {
      return 1;
    }
    if (left instanceof Pseudocode.Type) {
      return left.compareTo(right);
    }
    if (right instanceof Pseudocode.Type) {
      return right.compareTo(left) * -1;
    }
    return 0;
  };

  // Finally, expose Pseudocode to the environment.

  if (typeof module !== 'undefined') {
    module.exports = Pseudocode;

  } else {
    root.Pseudocode = Pseudocode;
  }

}(this));
