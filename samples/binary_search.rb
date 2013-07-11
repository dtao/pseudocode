def binary_search(haystack, needle)
  low = 0
  high = haystack ? haystack.length : low
  current = nil
  while low < high
    current = low + high >>> 1
    if haystack.current < needle
      low = current + 1
    else
      high = current
    end
  return low
end
