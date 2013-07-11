var Lazy = require('lazy.js');
var outputs = require('./outputs.js');
var translate = require('./translate.js');

// TODO: don't make these global?
var IDENTIFIER_TYPES = {};

function TemporaryOutput() {
  var buffer = [];

  this.out = function(msg, depth) {
    buffer.push({
      msg: msg,
      depth: depth
    });
  };

  this.pipe = function(output) {
    Lazy(buffer).each(function(part) {
      if (typeof part.msg !== 'string') {
        part.msg = unwrap(part.msg);
      }
      output.out(part.msg, part.depth);
    });
  };
}

function registerIdentifierType(identifier, type) {
  var name = identifier.name,
      typeList = IDENTIFIER_TYPES[name];

  if (!typeList) {
    typeList = IDENTIFIER_TYPES[name] = [];
  }

  typeList.push(type);
}

function getTypeForIdentifier(identifier) {
  var typeList = IDENTIFIER_TYPES[identifier.name];
  return typeList && typeList.length === 1 && typeList[0];
}

function emit(node, output, depth) {
  var tempOutput = new TemporaryOutput();

  switch (node.type) {
    case 'Program':
      Lazy(node.body).each(function(child) {
        emit(child, tempOutput, 0);
      });
      break;

    case 'BlockStatement':
      Lazy(node.body).each(function(child) {
        emit(child, tempOutput, depth);
      });
      break;

    case 'BreakStatement':
      tempOutput.out('break;');
      break;

    case 'EmptyStatement':
      tempOutput.out('\n', 0);
      break;

    case 'ExpressionStatement':
      tempOutput.out(toExpression(node.expression, depth) + ';', depth);
      break;

    case 'FunctionDeclaration':
      tempOutput.out(toFunctionDeclaration(node, depth), depth);
      break;

    case 'IfStatement':
      tempOutput.out('if (' + toExpression(node.test, depth) + ')', depth);
      tempOutput.out('{', depth);
      emit(node.consequent, tempOutput, depth + 1);
      tempOutput.out('}', depth);
      if (node.alternate) {
        tempOutput.out('else', depth);
        tempOutput.out('{', depth);
        emit(node.alternate, tempOutput, depth + 1);
        tempOutput.out('}', depth);
      }
      break;

    case 'SwitchStatement':
      tempOutput.out('switch (' + toExpression(node.discriminant, depth) + ')', depth);
      tempOutput.out('{', depth);
      Lazy(node.cases).each(function(child) {
        emit(child, tempOutput, depth + 1);
      });
      tempOutput.out('}', depth);
      break;

    case 'SwitchCase':
      if (node.test) {
        tempOutput.out('case ' + toExpression(node.test, depth) + ':', depth);
      } else {
        tempOutput.out('default:', depth);
      }
      Lazy(node.consequent).each(function(child) {
        emit(child, tempOutput, depth + 1);
      });
      break;

    case 'ThrowStatement':
      if (node.argument) {
        tempOutput.out('throw new Exception(' + toExpression(node.argument, depth) + ');', depth);
      } else {
        tempOutput.out('throw;', depth);
      }
      break;

    case 'VariableDeclaration':
      Lazy(node.declarations).each(function(child) {
        emit(child, tempOutput, depth);
      });
      break;

    case 'VariableDeclarator':
      tempOutput.out(toVariableDeclarator(node) + ';', depth);
      break;

    case 'WhileStatement':
      tempOutput.out('while (' + toExpression(node.test, depth) + ')', depth);
      tempOutput.out('{', depth);
      emit(node.body, tempOutput, depth + 1);
      tempOutput.out('}', depth)
      break;

    case 'ReturnStatement':
      if (node.argument) {
        tempOutput.out('return ' + toExpression(node.argument, depth) + ';', depth);
      } else {
        tempOutput.out('return;', depth);
      }
      break;

    default:
      throw 'Unknown node type: "' + node.type + '":\n' + JSON.stringify(node, null, 2).substring(0, 1000);
  }

  tempOutput.pipe(output || new outputs.Console());
}

function toParams(params, depth, braces) {
  braces = braces || '()';
  var paramExpressions = Lazy(params).map(function(param) {
    return toExpression(param, depth);
  });
  return braces.charAt(0) + paramExpressions.join(', ') + braces.charAt(1);
}

function toExpression(expression, depth) {
  switch (expression.type) {
    case 'Identifier':
      return expression.name;

    case 'Literal':
      if (expression.value === 'undefined' || expression.value === 'null') {
        return 'null';
      }
      if (typeof expression.value === 'string') {
        return '"' + expression.value + '"';
      }
      return expression.value;

    case 'ArrayExpression':
      return 'new [] ' + toParams(expression.elements, depth, '{}');

    case 'AssignmentExpression':
      return toExpression(expression.left, depth) + ' ' + toOperator(expression.operator) + ' ' + toExpression(expression.right, depth);

    case 'BinaryExpression':
      return toExpression(expression.left, depth) + ' ' + toOperator(expression.operator) + ' ' + toExpression(expression.right, depth);

    case 'CallExpression':
      return toExpression(expression.callee, depth) + toParams(expression.arguments, depth);

    case 'ConditionalExpression':
      return toExpression(expression.test, depth) + ' ? ' +
        toExpression(expression.consequent, depth) + ' : ' +
        toExpression(expression.alternate, depth);

    case 'FunctionExpression':
      return toLambda(expression, depth);

    case 'LogicalExpression':
      return toExpression(expression.left, depth) + ' ' + toOperator(expression.operator) + ' ' + toExpression(expression.right, depth);

    case 'MemberExpression':
      return toExpression(expression.object, depth) + '.' + toExpression(expression.property, depth);

    case 'NewExpression':
      return 'new ' + toExpression(expression.callee, depth) + toParams(expression.arguments, depth);

    case 'ThisExpression':
      return 'this';

    case 'UnaryExpression':
      return toUnaryExpression(expression);
  }

  throw 'Unknown expression type: "' + expression.type + '":\n' + JSON.stringify(expression, null, 2);
}

function toFunctionDeclaration(node, depth) {
  var possibleReturnTypes = recursivelyFindChildNodesOfType(node, 'ReturnStatement')
    .map(function(statement) {
      return guessExpressionType(statement.argument);
    })
    .compact()
    .uniq()
    .toArray();

  var returnType = 'object';
  if (possibleReturnTypes.length === 1) {
    returnType = possibleReturnTypes[0];
    registerIdentifierType(node.id, returnType);
  }

  var functionName = translate.fromCamelCase(toExpression(node.id)).toPascalCase();

  var buffer = new outputs.String();
  buffer.out(returnType + ' ' + functionName + toParams(node.params), depth);
  buffer.out('{', depth);
  emit(node.body, buffer, depth + 1);
  buffer.out('}', depth);

  return buffer.toString();
}

function toVariableDeclarator(node) {
  var variableType = guessExpressionType(node.init);

  if (variableType) {
    registerIdentifierType(node.id, variableType);
  }

  var buffer = new outputs.String();
  buffer.out((variableType || 'object') + ' ' + node.id.name + ' = ' + (node.init ? toExpression(node.init) : 'null'), 0);

  return buffer.toString();
}

function toLambda(functionExpression, depth) {
  depth = depth || 0;

  var buffer = new outputs.String();
  buffer.out(toParams(functionExpression.params, depth) + ' =>', 0);
  buffer.out('{', depth);
  emit(functionExpression.body, buffer, depth + 1);
  buffer.out('}', depth);

  return buffer.toString();
}

function toUnaryExpression(expression) {
  switch (expression.operator) {
    case 'typeof':
      return toExpression(expression.argument) + '.GetType()';

    default:
      return expression.operator + '(' + toExpression(expression.argument) + ')';
  }
}

function toOperator(operator) {
  return operator;
}

function guessExpressionType(expression) {
  if (!expression) {
    return undefined;
  }

  switch (expression.type) {
    case 'Identifier':
      return getTypeForIdentifier(expression);

    case 'Literal':
      switch (typeof expression.value) {
        case 'string':
          return 'string';
        case 'number':
          return expression.value === Math.floor(expression.value) ? 'int' : 'double';
        case 'boolean':
          return 'bool';
      }

    case 'ConditionalExpression':
      return guessConditionalExpressionType(expression);

    case 'MemberExpression':
      return guessMemberExpressionType(expression);
  }

  return undefined;
}

function guessConditionalExpressionType(expression) {
  var consequentType = guessExpressionType(expression.consequent);
  var alternateType = guessExpressionType(expression.alternate);

  if (consequentType === alternateType) {
    return consequentType;
  }

  return undefined;
}

function guessMemberExpressionType(expression) {
  switch (expression.property.name) {
    case 'count':
    case 'length':
      return 'int';
  }

  return undefined;
}

function recursivelyFindChildNodesOfType(node, type) {
  var children =
    node.type === 'BlockStatement' ? node.body :
    node.type === 'FunctionDeclaration' ? node.body.body : [];

  return Lazy(children)
    .map(function(node) {
      if (node.type === type) {
        return node;
      } else if (node.body) {
        return recursivelyFindChildNodesOfType(node, type);
      }
    })
    .flatten()
    .compact();
}

module.exports = {
  emit: emit
};
