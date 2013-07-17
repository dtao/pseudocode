function nestedScope(z) {
  var x = 0;
  var addToX = function(y) {
    return x + y;
  };
  return addToX(z);
}

console.log(nestedScope(5));
