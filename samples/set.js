function Set() {
  this.table   = {};
  this.objects = [];
}

Set.prototype.add = function(e) {
  var table = this.table;

  switch (typeof e) {
    case 'object':
      return addToArrayIfNotPresent(e, this.objects);

    case 'string':
      e = prefixIfNecessary(e);
      return addToObjectIfNotPresent(e, this.table);

    default:
      return addToObjectIfNotPresent(e, this.table);
  }
};

Set.prototype.contains = function(e) {
  switch (typeof e) {
    case 'object':
      return presentInArray(this.objects);

    case 'string':
      e = prefixIfNecessary(e);
      return !!this.table[e];

    default:
      return !!this.table[e];
  }
};

function presentInArray(element, array) {
  for (var i = 0; i < array.length; ++i) {
    if (array[i] === element) {
      return true;
    }
  }

  return false;
}

function prefixIfNecessary(str) {
  var firstChar = str.charAt(0);
  if ('tfun'.indexOf(firstChar) >= 0 || (firstChar >= '0' && firstChar <= '9')) {
    return '@' + str;
  }

  return str;
}

function addToArrayIfNotPresent(element, array) {
  if (presentInArray(element, array)) {
    return false;
  }

  array.push(element);
  return true;
}

function addToObjectIfNotPresent(element, object) {
  if (object[element]) {
    return false;
  }

  object[element] = true;
  return true;
}
