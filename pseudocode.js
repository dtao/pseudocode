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

    // if (!identifier) {
    //   this.fail('cannot register a null identifier');
    // }

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

    if (!dataType) {
      this.fail('invalid data type: ' + dataType);
    }

    if (dataType === 'object') {
      return;
    }

    var typeList = this.identifierTypes[identifier.name];
    if (!typeList) {
      typeList = this.identifierTypes[identifier.name] = new Pseudocode.SetList();
    }

    // Don't replace a strongly-typed function w/ 'function'.
    if (dataType === 'function') {
      if (this.getTypeForIdentifier(identifier) instanceof Pseudocode.FunctionType) {
        return;
      }
    }

    // Similarly, don't replace a strongly-typed collection w/ 'array'.
    if (dataType === 'array') {
      if (this.getTypeForIdentifier(identifier) instanceof Pseudocode.CollectionType) {
        return;
      }
    }

    typeList.push(dataType);
  };

  /**
   * Registers a possible return type for a function.
   *
   * @param {Pseudocode.Identifier} identifier The identifier of the function.
   * @param {string=} returnType The name of the return type.
   */
  Pseudocode.Node.prototype.registerFunctionReturnType = function(identifier, returnType) {
    if (this.getTypeForIdentifier(identifier) === 'function') {
      this.clearTypesForIdentifier(identifier);
    }

    var returnType = returnType ?
      new Pseudocode.FunctionType(returnType) : 'function';

    this.registerIdentifierType(identifier, returnType);
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
      new Pseudocode.CollectionType(options.elementType) : 'array';

    this.registerIdentifierType(identifier, collectionType);
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
    var typeList = this.identifierTypes[identifier.name];
    return typeList && typeList.length === 1 && typeList.get(0);
  };

  /**
   * Clears registered types for the given identifier.
   *
   * @param {Pseudocode.Identifier} identifier The identifier to clear.
   */
  Pseudocode.Node.prototype.clearTypesForIdentifier = function(identifier) {
    delete this.identifierTypes[identifier.name];
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
        data = identifiers[child.id.name] = { dataType: child.id.getDataType().toString() };

      } else if (child instanceof Pseudocode.Identifier) {
        if (child.isDefinedHere()) {
          data = identifiers[child.name] = { dataType: child.getDataType().toString() };
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
   * @param {string} dataType The probably data type for the expression.
   */
  Pseudocode.Expression.prototype.probableDataType = function(dataType) {
    if (this instanceof Pseudocode.Identifier) {
      this.scope.registerIdentifierType(this, dataType);
    }
    if (this instanceof Pseudocode.MemberExpression && this.object instanceof Pseudocode.Identifier) {
      if (this.computed && this.property.getDataType() === 'int') {
        this.scope.registerCollectionType(this.object, {
          elementType: dataType
        });
      }
    }
  };

  /**
   * An expandable list of strings without duplicates.
   *
   * @constructor
   */
  Pseudocode.SetList = function() {
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
   * Represents a function along with its return type.
   *
   * @param {string} returnType The return type of the function.
   * @constructor
   */
  Pseudocode.FunctionType = function(returnType) {
    this.functionType = 'function';
    this.returnType = returnType;
  };

  Pseudocode.FunctionType.prototype.toString = function() {
    return this.returnType ?
      'func<' + this.returnType + '>' :
      'function';
  };

  /**
   * Represents a collection along with the type of elements it contains.
   *
   * @param {string} elementType The type of elements in the collection.
   * @constructor
   */
  Pseudocode.CollectionType = function(elementType) {
    this.collectionType = 'array';
    this.elementType = elementType;
  };

  Pseudocode.CollectionType.prototype.toString = function() {
    return this.elementType ?
      'array<' + this.elementType + '>' :
      'array';
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
      'EmptyStatement': [],
      'ReturnStatement': ['argument'],
    },

    Expressions: {
      'Identifier': [],
      'Literal': [],
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
      'FunctionExpression': ['id', 'params', 'body']
    }
  };

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

  // Intended to be used as a mix-in for FunctionDeclaration and FunctionExpression types
  Pseudocode.Functional = {};

  Pseudocode.Functional.getChildScope = function() {
    return this.createScope();
  };

  Pseudocode.Functional.finalize = function() {
    if (this.id) {
      this.scope.registerIdentifier(this.id);
    }

    Lazy(this.params).each(function(param) {
      param.scope.registerIdentifier(param);
    });

    // Function declarations are a bit weird because the identifier belongs in the scope outside the
    // function, but all other children belong to the scope inside the function. (Actually makes
    // perfect sense, just doesn't lend itself to the most graceful implementation.)
    if (this.id) {
      this.id.scope = this.scope;
    }

    this.tryToInferType();
  };

  Pseudocode.Functional.tryToInferType = function() {
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

    if (returnTypes.length === 1) {
      this.dataType = new Pseudocode.FunctionType(returnTypes.get(0));
    }
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

  Pseudocode.Identifier.prototype.finalize = function() {
    var data = this.program.allIdentifiers[this.name] || { scopes: [] };
    data.scopes.push('' + this.scope);
    this.program.allIdentifiers[this.name] = data;
  };

  Pseudocode.Identifier.prototype.getDataType = function() {
    return this.inferDataType();
  };

  Pseudocode.Identifier.prototype.inferDataType = function() {
    return this.scope.getTypeForIdentifier(this) || 'object';
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

  Pseudocode.Identifier.prototype.toString = function() {
    return this.type + ' "' + this.name + '"';
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
        this.left.probableDataType(this.right.getDataType());
    }
  };

  Pseudocode.AssignmentExpression.prototype.inferDataType = function() {
    switch (this.operator) {
      // TODO: implement type deduction w/ multiple possibilities
      // (i.e., this could really be a string)
      case '+=':
        return 'int'; // or string

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
      // TODO: implement type deduction w/ multiple possibilities
      // (i.e., this could really be a string)
      case '+':
      case '<':
      case '>':
      case '<=':
      case '>=':
        this.left.probableDataType('int');
        this.right.probableDataType('int');
        break;

      case '-':
      case '*':
      case '/':
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
      // TODO: implement type deduction w/ multiple possibilities
      // (i.e., this could really be a string)
      case '+':
        return 'int'; // or string

      case '-':
      case '*':
      case '/':
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
      this.callee.object.scope.registerCollectionType(this.callee.object, {
        elementType: this.arguments[0].getDataType()
      });
    }
  };

  Pseudocode.CallExpression.prototype.inferDataType = function() {
    var functionType = this.callee.getDataType();
    return functionType.returnType || 'object';
  };

  Pseudocode.ArrayExpression.prototype.inferDataType = function() {
    var elementTypes = Lazy(this.elements)
      .map(function(node) { return node.getDataType() })
      .uniq()
      .toArray();

    if (elementTypes.length === 1) {
      return new Pseudocode.CollectionType(elementTypes[0]);
    }

    return 'array';
  };

  Pseudocode.ObjectExpression.prototype.inferDataType = function() {
    return 'object';
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
        this.id = new Pseudocode.Identifier({
          type: 'Identifier',
          name: '(anonymous)'
        });
      }
    }
  };

  Pseudocode.FunctionExpression.prototype.inferDataType = function() {
    return this.dataType || 'function';
  };

  if (typeof module !== 'undefined') {
    module.exports = Pseudocode;

  } else {
    root.Pseudocode = Pseudocode;
  }

}(this));
