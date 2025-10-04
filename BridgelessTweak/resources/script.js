;(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  if (g.__BRIDGELESS_PAYLOAD_INSTALLED__) {
    if (typeof g.__nativeLog === 'function') {
      g.__nativeLog('[Bridgeless] payload already installed', 0);
    }
    return;
  }
  g.__BRIDGELESS_PAYLOAD_INSTALLED__ = true;
  g.__BRIDGELESS_PAYLOAD_MARKER__ = Date.now();
  try {
    if (typeof g.__nativeLog === 'function') {
      g.__nativeLog('[Bridgeless] minimal payload executed', 0);
    } else if (g.console && typeof g.console.log === 'function') {
      g.console.log('[Bridgeless] minimal payload executed');
    }
  } catch (_) {}
})();
