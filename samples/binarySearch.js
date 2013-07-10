function sortedIndex(haystack, needle) {
  var low = 0,
      high = haystack ? haystack.length : low,
      current;

  while (low < high) {
    current = (low + high) >>> 1;
    if (haystack[current] < needle) {
      low = current + 1;
    } else {
      high = current;
    }
  }

  return low;
}
