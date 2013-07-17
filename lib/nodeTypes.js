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
    'SwitchStatement': ['discriminant', 'cases'],
    'SwitchCase': ['test', 'consequent'],
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
