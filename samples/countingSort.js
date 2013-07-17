function countingSort(array) {
  var range  = minMax(array),
      min    = range[0],
      counts = createArray(range);

  for (var i = 0; i < array.length; ++i) {
    counts[array[i] - min] += 1;
  }

  var result = [];
  for (var i = 0; i < counts.length; ++i) {
    while (counts[i]-- > 0) {
      result.push(i + min);
    }
  }

  return result;
}

function createArray(range) {
  var arr = [];
  for (var i = range[0]; i <= range[1]; ++i) {
    arr.push(0);
  }
  return arr;
}

function minMax(array) {
  var min = array[0],
      max = array[0];

  for (var i = 1; i < array.length; ++i) {
    if (array[i] < min) {
      min = array[i];
    }
    if (array[i] > max) {
      max = array[i];
    }
  }
  return [min, max];
}

module.exports = countingSort;
