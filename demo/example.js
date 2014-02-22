// Literals are easy.
var i = 1;
var s = 'foo';
var b = true;

// From there we can propagate types to known identifiers (variables).
var i2 = i;
var s2 = s;
var b2 = b;

// Arrays containing homogenous elements are easy, too.
var intArr = [i, 2];
var strArr = [s, 'bar'];
var blnArr = [b, false];

// Arrays w/ heterogenous elements just default to array<object>.
var objArr = [i, s, b];

// Can we nest them? Yep.
var nestedArr = [intArr, [3]];

// Functions are pretty straightforward as well.
function getInt() {
  return 5;
}

// The parameters can be inferred from their usage.
function takeString(str) {
  var firstChar = str.charAt(0);
}
