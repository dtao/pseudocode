function throttle(fn, delay) {
  var timeoutId,
      throttled;

  return function() {
    var self = this,
        args = arguments;

    if (!timeoutId) {
      timeout = setTimeout(function callback() {
        if (throttled) {
          timeoutId = setTimeout(callback, delay);
          throttled = false;

        } else {
          fn.apply(self, arguments);
          timeoutId = undefined;
        }
      }, delay);

    } else {
      throttled = true;
    }
  };
}

window.addEventListener('load', function() {
  var output = document.getElementById('output');
  var editor = CodeMirror.fromTextArea(document.getElementById('source'), {
    theme: 'ambiance'
  });

  var handleChange = function(e, obj) {
    try {
      var program = Pseudocode.fromJavaScript(editor.getValue()).program;
      var identifiers = program.getIdentifiers(true);
      output.textContent = JSON.stringify(identifiers, null, 2);
      hljs.highlightBlock(output);

    } catch (err) {
      output.textContent = err + '\n' + err.stack;
    }
  };

  editor.on('change', throttle(handleChange, 1500));
});
