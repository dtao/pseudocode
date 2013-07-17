module.exports = {
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
    'ReturnStatement': ['argument'],
  },

  Expressions: {
    'Identifier': [],
    'Literal': [],
    'AssignmentExpression': ['left', 'right'],
    'BinaryExpression': ['left', 'right'],
    'ConditionalExpression': ['test', 'consequent', 'alternate'],
    'UpdateExpression': ['argument'],
    'MemberExpression': ['object', 'property'],
    'CallExpression': ['callee', 'arguments'],
    'ArrayExpression': ['elements']
  }
};
