module.exports = {
  'Program': ['body'],

  'BlockStatement': ['body'],

  'FunctionDeclaration': ['id', 'params', 'body'],

  'VariableDeclaration': ['declarations'],

  'VariableDeclarator': ['id', 'init'],

  'ExpressionStatement': ['expression'],

  'IfStatement': ['test', 'consequent', 'alternate'],

  'WhileStatement': ['test', 'body'],

  'ReturnStatement': ['argument'],

  'Identifier': [],

  'Literal': [],

  'AssignmentExpression': ['left', 'right'],

  'BinaryExpression': ['left', 'right'],

  'ConditionalExpression': ['test', 'consequent', 'alternate'],

  'MemberExpression': ['object', 'property']
};
