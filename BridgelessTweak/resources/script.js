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

  function bridgelessLog(tag, payload) {
    var prefix = '[Bridgeless] ' + tag;
    var message = typeof payload === 'undefined' ? prefix : prefix + ': ' + payload;
    try {
      if (typeof g.__nativeLog === 'function') {
        g.__nativeLog(message, 0);
      } else if (g.console && typeof g.console.log === 'function') {
        g.console.log(message);
      }
    } catch (_) {}
  }

  function formatError(err) {
    var str;
    if (err && typeof err === 'object') {
      str = err.stack || err.message || Object.prototype.toString.call(err);
    } else {
      str = String(err);
    }
    if (typeof str === 'string' && str.length > 400) {
      return str.slice(0, 397) + '...';
    }
    return str;
  }

  function samplePropertyNames(value, limit, includeNonEnumerable) {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
      return { total: 0, sample: [] };
    }
    var names;
    try {
      names = includeNonEnumerable ? Object.getOwnPropertyNames(value) : Object.keys(value);
    } catch (err) {
      return { total: null, sample: ['<failed: ' + formatError(err) + '>'] };
    }
    var sample = names.slice(0, limit);
    if (names.length > limit) {
      sample.push('... +' + (names.length - limit) + ' more');
    }
    return { total: names.length, sample: sample };
  }

  function sampleMapKeys(map, limit) {
    var results = [];
    var truncated = false;
    try {
      var iterator = map.keys();
      for (var i = 0; i < limit; i++) {
        var next = iterator.next();
        if (next.done) {
          break;
        }
        var key = next.value;
        if (typeof key === 'string') {
          results.push(key);
        } else if (typeof key === 'number') {
          results.push(String(key));
        } else {
          try {
            results.push(JSON.stringify(key));
          } catch (_) {
            results.push(String(key));
          }
        }
      }
    } catch (err) {
      return { sample: ['<failed: ' + formatError(err) + '>'], truncated: null };
    }
    if (typeof map.size === 'number' && map.size > limit) {
      truncated = true;
      results.push('... +' + (map.size - limit) + ' more');
    }
    return { sample: results, truncated: truncated };
  }

  function containsAppRegistryKey(arr) {
    if (!arr) {
      return false;
    }
    for (var i = 0; i < arr.length; i++) {
      var value = arr[i];
      if (typeof value === 'string' && /AppRegistry/i.test(value)) {
        return true;
      }
    }
    return false;
  }

  function describeRequireContext(requireFunc) {
    var contextFunc = requireFunc && requireFunc.context;
    if (typeof contextFunc !== 'function') {
      return { exists: false };
    }
    var info = {
      exists: true,
      type: typeof contextFunc,
      name: contextFunc.name || null,
      ownKeysSample: samplePropertyNames(contextFunc, 8, false).sample
    };
    try {
      var src = String(contextFunc);
      if (src.length > 160) {
        src = src.slice(0, 157) + '...';
      }
      info.firstLine = src.split('\n')[0];
    } catch (err) {
      info.firstLine = '<failed: ' + formatError(err) + '>';
    }
    return info;
  }

  function describeRequire(requireFunc) {
    if (typeof requireFunc !== 'function') {
      return { exists: false };
    }
    var info = {
      exists: true,
      type: typeof requireFunc,
      name: requireFunc.name || null,
      length: requireFunc.length,
      firstLine: (function () {
        try {
          var src = String(requireFunc);
          if (src.length > 160) {
            src = src.slice(0, 157) + '...';
          }
          return src.split('\n')[0];
        } catch (err) {
          return '<failed: ' + formatError(err) + '>';
        }
      })(),
      ownKeysSample: samplePropertyNames(requireFunc, 10, false).sample,
      hasResolveWeak: typeof requireFunc.resolveWeak === 'function',
      hasImportLazy: typeof requireFunc.importLazy === 'function',
      hasRegisterSegment: typeof requireFunc.registerSegment === 'function',
      hasGetModules: typeof requireFunc.getModules === 'function',
      hasPackModuleId: typeof requireFunc.packModuleId === 'function',
      hasUnpackModuleId: typeof requireFunc.unpackModuleId === 'function',
      hasContext: typeof requireFunc.context === 'function',
      contextInfo: describeRequireContext(requireFunc)
    };
    return info;
  }

  function describeModules(modules) {
    if (!modules) {
      return { exists: false };
    }
    var ctor = modules.constructor && modules.constructor.name;
    var info = {
      exists: true,
      constructorName: ctor || typeof modules,
      containerType: Array.isArray(modules) ? 'Array' : modules instanceof Map ? 'Map' : typeof modules
    };
    if (modules instanceof Map) {
      var mapSample = sampleMapKeys(modules, 12);
      info.size = typeof modules.size === 'number' ? modules.size : null;
      info.sampleKeys = mapSample.sample;
      info.containsAppRegistryKey = containsAppRegistryKey(mapSample.sample);
      info.truncated = mapSample.truncated;
    } else if (typeof modules === 'object' || typeof modules === 'function') {
      var objSummary = samplePropertyNames(modules, 12, false);
      info.keyCountHint = objSummary.total;
      info.sampleKeys = objSummary.sample;
      info.containsAppRegistryKey = containsAppRegistryKey(objSummary.sample);
    } else {
      info.sampleKeys = ['<unsupported modules container type>'];
    }
    return info;
  }

  function describeGlobalAppRegistry(appRegistry) {
    if (typeof appRegistry === 'undefined') {
      return { exists: false };
    }
    var summary = {
      exists: true,
      type: typeof appRegistry,
      constructorName: appRegistry && appRegistry.constructor && appRegistry.constructor.name || null
    };
    if (appRegistry && (typeof appRegistry === 'object' || typeof appRegistry === 'function')) {
      var keysSummary = samplePropertyNames(appRegistry, 12, false);
      summary.keysSample = keysSummary.sample;
      summary.keyCountHint = keysSummary.total;
      summary.hasRegisterComponent = typeof appRegistry.registerComponent === 'function';
      summary.hasGetAppKeys = typeof appRegistry.getAppKeys === 'function';
    }
    return summary;
  }

  function describeFactoryFunction(factoryFn) {
    if (typeof factoryFn !== 'function') {
      return { exists: false };
    }
    var info = {
      exists: true,
      name: factoryFn.name || null,
      length: factoryFn.length,
      ownKeysSample: samplePropertyNames(factoryFn, 8, false).sample
    };
    try {
      var src = String(factoryFn);
      if (src.length > 160) {
        src = src.slice(0, 157) + '...';
      }
      info.firstLine = src.split('\n')[0];
    } catch (err) {
      info.firstLine = '<failed: ' + formatError(err) + '>';
    }
    return info;
  }

  function collectModulesSummary(globalObj) {
    var result = {
      hasWindowModulesProperty: !!(globalObj.window && globalObj.window.modules),
      hasGlobalModulesProperty: typeof globalObj.modules !== 'undefined',
      hasModulesFactory: typeof globalObj.__c === 'function' || (globalObj.window && typeof globalObj.window.__c === 'function'),
      windowFactoryInfo: describeFactoryFunction(globalObj.window && globalObj.window.__c),
      globalFactoryInfo: describeFactoryFunction(globalObj.__c),
      source: null,
      containerDetails: { exists: false }
    };

    var container = null;
    if (globalObj.window && globalObj.window.modules) {
      container = globalObj.window.modules;
      result.source = 'window.modules';
    } else if (typeof globalObj.modules !== 'undefined') {
      container = globalObj.modules;
      result.source = 'global.modules';
    }

    if (container) {
      try {
        result.containerDetails = describeModules(container);
      } catch (err) {
        result.containerDetails = { exists: false, error: formatError(err) };
      }
    }

    return { summary: result, container: container };
  }

  function findAppRegistryKeys(modules) {
    if (!modules) {
      return { inspected: false };
    }
    var keys = [];
    var total = null;
    var truncated = false;
    var limit = 200;
    try {
      if (modules instanceof Map) {
        var iterator = modules.keys();
        var index = 0;
        while (index < limit) {
          var next = iterator.next();
          if (next.done) {
            break;
          }
          keys.push(String(next.value));
          index++;
        }
        if (typeof modules.size === 'number') {
          total = modules.size;
          truncated = modules.size > limit;
        }
      } else if (typeof modules === 'object' || typeof modules === 'function') {
        var objectKeys = Object.keys(modules);
        total = objectKeys.length;
        if (objectKeys.length > limit) {
          keys = objectKeys.slice(0, limit);
          truncated = true;
        } else {
          keys = objectKeys;
        }
      } else {
        return { inspected: false, note: 'unsupported modules container type' };
      }
    } catch (err) {
      return { inspected: false, error: formatError(err) };
    }
    var matches = [];
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (typeof key === 'string' && /AppRegistry/i.test(key)) {
        matches.push(key);
        if (matches.length >= 5) {
          break;
        }
      }
    }
    return {
      inspected: true,
      examinedKeys: keys.length,
      totalHint: total,
      truncated: truncated,
      matchingKeys: matches
    };
  }

  function inspectAppRegistry(globalObj, requireFunc, modules, moduleSummary) {
    var specifiers = [
      'AppRegistry',
      'react-native/Libraries/ReactNative/AppRegistry',
      'react-native/Libraries/ReactNative/renderApplication',
      'react-native/Libraries/ReactNative/AppContainer'
    ];
    var capabilities = {
      hasRequire: typeof requireFunc === 'function',
      hasResolveWeak: !!(requireFunc && typeof requireFunc.resolveWeak === 'function'),
      hasImportDefault: !!(requireFunc && typeof requireFunc.importDefault === 'function'),
      hasImportAll: !!(requireFunc && typeof requireFunc.importAll === 'function'),
      hasContext: !!(requireFunc && typeof requireFunc.context === 'function'),
      notes: [
        'Dynamic require attempts deliberately skipped to avoid metro state mutation',
        'Inspect window/modules and module keys for AppRegistry occurrences'
      ]
    };

    return {
      global: describeGlobalAppRegistry(globalObj && globalObj.AppRegistry),
      requireCapabilities: capabilities,
      specifiersConsidered: specifiers,
      moduleKeyMatches: findAppRegistryKeys(modules),
      modulesContext: moduleSummary
    };
  }

  function sampleGlobalKeys(globalObj, limit) {
    return samplePropertyNames(globalObj, limit, true);
  }

  function safeJson(value) {
    var seen = [];
    try {
      return JSON.stringify(value, function (key, val) {
        if (typeof val === 'function') {
          return '[Function]';
        }
        if (typeof val === 'symbol') {
          return val.toString();
        }
        if (val && typeof val === 'object') {
          if (seen.indexOf(val) !== -1) {
            return '[Circular]';
          }
          seen.push(val);
        }
        if (typeof val === 'string' && val.length > 500) {
          return val.slice(0, 497) + '...';
        }
        return val;
      });
    } catch (err) {
      return '<<Failed to stringify: ' + formatError(err) + '>>';
    }
  }

  var overlayState = {
    originalRequire: null,
    metroRequire: null,
    react: null,
    reactNative: null,
    appRegistry: null,
    overlayComponent: null,
    requireHookInstalled: false,
    overlayAnnouncementLogged: false,
    retryTimer: null,
    scannedModuleIds: Object.create(null)
  };

  var wrappedComponentCache = typeof WeakMap === 'function' ? new WeakMap() : null;

  function normalizeModule(maybeModule) {
    if (maybeModule && typeof maybeModule === 'object') {
      if (maybeModule.__esModule && 'default' in maybeModule) {
        return maybeModule.default || maybeModule;
      }
      if ('default' in maybeModule && maybeModule.default) {
        return maybeModule.default;
      }
    }
    return maybeModule;
  }

  function copyStaticProperties(source, target) {
    if (!source || !target) {
      return;
    }
    try {
      var keys = Object.getOwnPropertyNames(source);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key === 'length' || key === 'name' || key === 'prototype') {
          continue;
        }
        if (Object.prototype.hasOwnProperty.call(target, key)) {
          continue;
        }
        try {
          var descriptor = Object.getOwnPropertyDescriptor(source, key);
          if (descriptor) {
            Object.defineProperty(target, key, descriptor);
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  function createOverlayComponent(React, ReactNativeModule) {
    var ReactNative = normalizeModule(ReactNativeModule);
    if (!ReactNative || !ReactNative.View || !ReactNative.Text) {
      return null;
    }
    var View = ReactNative.View;
    var Text = ReactNative.Text;
    var StyleSheet = ReactNative.StyleSheet;
    var styles;
    if (StyleSheet && typeof StyleSheet.create === 'function') {
      styles = StyleSheet.create({
        container: {
          position: 'absolute',
          top: 32,
          alignSelf: 'center',
          backgroundColor: 'rgba(0,0,0,0.6)',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 12,
          zIndex: 99999
        },
        text: {
          color: '#ffffff',
          fontWeight: '600',
          fontSize: 14
        }
      });
    } else {
      styles = {
        container: {
          position: 'absolute',
          top: 32,
          alignSelf: 'center',
          backgroundColor: 'rgba(0,0,0,0.6)',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 12,
          zIndex: 99999
        },
        text: {
          color: '#ffffff',
          fontWeight: '600',
          fontSize: 14
        }
      };
    }

    function OverlayComponent() {
      return React.createElement(
        View,
        { pointerEvents: 'none', style: styles.container },
        React.createElement(Text, { style: styles.text }, 'Tweak loaded')
      );
    }

    return OverlayComponent;
  }

  function getOverlayComponentOrNull() {
    if (overlayState.overlayComponent) {
      return overlayState.overlayComponent;
    }
    if (!overlayState.react || !overlayState.reactNative) {
      return null;
    }
    var OverlayComponent = createOverlayComponent(overlayState.react, overlayState.reactNative);
    if (!OverlayComponent) {
      return null;
    }
    overlayState.overlayComponent = OverlayComponent;
    return OverlayComponent;
  }

  function maybeWrapComponent(Component) {
    if (!Component) {
      return Component;
    }
    var React = overlayState.react;
    var OverlayComponent = getOverlayComponentOrNull();
    if (!React || !OverlayComponent || typeof React.createElement !== 'function') {
      return Component;
    }
    if (wrappedComponentCache && wrappedComponentCache.has(Component)) {
      return wrappedComponentCache.get(Component);
    }
    var Fragment = React.Fragment;
    function Wrapper(props) {
      if (Fragment) {
        return React.createElement(
          Fragment,
          null,
          React.createElement(Component, props),
          React.createElement(OverlayComponent, { key: 'tweak-overlay' })
        );
      }
      return [
        React.createElement(Component, Object.assign({ key: 'tweak-original' }, props)),
        React.createElement(OverlayComponent, { key: 'tweak-overlay' })
      ];
    }
    var displayName = Component.displayName || Component.name || 'Component';
    Wrapper.displayName = 'TweakOverlay(' + displayName + ')';
    copyStaticProperties(Component, Wrapper);
    if (wrappedComponentCache) {
      wrappedComponentCache.set(Component, Wrapper);
    }
    return Wrapper;
  }

  function wrapComponentProvider(provider) {
    if (typeof provider !== 'function') {
      return provider;
    }
    if (provider.__tweakWrapped) {
      return provider;
    }
    function wrappedProvider() {
      var provided = provider();
      var normalized = normalizeModule(provided);
      var maybeComponent = maybeWrapComponent(normalized);
      if (maybeComponent) {
        return maybeComponent;
      }
      return normalized || provided;
    }
    wrappedProvider.__tweakWrapped = true;
    wrappedProvider.__tweakOriginal = provider;
    return wrappedProvider;
  }

  function wrapExistingRunnables(appRegistry) {
    if (!appRegistry || typeof appRegistry.getRegistry !== 'function') {
      return;
    }
    var registry;
    try {
      registry = appRegistry.getRegistry();
    } catch (err) {
      bridgelessLog('AppRegistry registry access failed', formatError(err));
      return;
    }
    if (!registry || !registry.runnables) {
      return;
    }
    var keys = Object.keys(registry.runnables);
    for (var i = 0; i < keys.length; i++) {
      var appKey = keys[i];
      var runnable = registry.runnables[appKey];
      if (!runnable) {
        continue;
      }
      if (typeof runnable.componentProvider === 'function') {
        runnable.componentProvider = wrapComponentProvider(runnable.componentProvider);
      }
    }
  }

  function patchAppRegistry(appRegistry) {
    if (!appRegistry || appRegistry.__tweakPatched) {
      return;
    }
    if (typeof appRegistry.registerComponent === 'function') {
      var originalRegisterComponent = appRegistry.registerComponent;
      appRegistry.registerComponent = function (appKey, getComponent) {
        if (typeof getComponent === 'function') {
          arguments[1] = wrapComponentProvider(getComponent);
        }
        return originalRegisterComponent.apply(this, arguments);
      };
      appRegistry.registerComponent.__tweakOriginal = originalRegisterComponent;
    }
    if (typeof appRegistry.registerComponentWithCallback === 'function') {
      var originalRegisterComponentWithCallback = appRegistry.registerComponentWithCallback;
      appRegistry.registerComponentWithCallback = function (appKey, getComponent, callback) {
        if (typeof getComponent === 'function') {
          arguments[1] = wrapComponentProvider(getComponent);
        }
        return originalRegisterComponentWithCallback.apply(this, arguments);
      };
      appRegistry.registerComponentWithCallback.__tweakOriginal = originalRegisterComponentWithCallback;
    }
    wrapExistingRunnables(appRegistry);
    appRegistry.__tweakPatched = true;
    bridgelessLog('AppRegistry patched for tweak overlay');
  }

  function captureFromGlobals() {
    if (!overlayState.react && g.React && typeof g.React.createElement === 'function') {
      overlayState.react = g.React;
    }
    if (!overlayState.reactNative && g.ReactNative && g.ReactNative.View && g.ReactNative.Text) {
      overlayState.reactNative = normalizeModule(g.ReactNative);
    }
    if (!overlayState.appRegistry && g.AppRegistry && typeof g.AppRegistry.registerComponent === 'function') {
      overlayState.appRegistry = g.AppRegistry;
    }
    if (!overlayState.appRegistry && overlayState.reactNative && overlayState.reactNative.AppRegistry) {
      overlayState.appRegistry = overlayState.reactNative.AppRegistry;
    }
    if (overlayState.appRegistry) {
      patchAppRegistry(overlayState.appRegistry);
    }
  }

  function attemptOverlayInstallation(reason) {
    try {
      if (overlayState.appRegistry) {
        patchAppRegistry(overlayState.appRegistry);
      }
      var overlayComponent = getOverlayComponentOrNull();
      if (!overlayComponent) {
        return;
      }
      if (overlayState.appRegistry) {
        wrapExistingRunnables(overlayState.appRegistry);
      }
      if (!overlayState.overlayAnnouncementLogged) {
        var details = [];
        if (reason) {
          details.push(reason);
        }
        if (overlayState.react) {
          details.push('react');
        }
        if (overlayState.reactNative) {
          details.push('react-native');
        }
        if (overlayState.appRegistry) {
          details.push('appRegistry');
        }
        bridgelessLog('Overlay ready', details.join(' | '));
        overlayState.overlayAnnouncementLogged = true;
      }
    } catch (err) {
      bridgelessLog('Overlay install error', formatError(err));
    }
  }

  function inspectModuleCapture(moduleId, moduleExports) {
    var normalized = normalizeModule(moduleExports);
    if (!overlayState.react && normalized && typeof normalized.createElement === 'function' && (normalized.Component || normalized.PureComponent)) {
      overlayState.react = normalized;
      bridgelessLog('React module detected', String(moduleId));
    }
    if (!overlayState.appRegistry && normalized && typeof normalized.registerComponent === 'function' && typeof normalized.runApplication === 'function') {
      overlayState.appRegistry = normalized;
      bridgelessLog('AppRegistry module detected', String(moduleId));
      patchAppRegistry(normalized);
    }
    if (!overlayState.reactNative) {
      var maybeReactNative = normalized && typeof normalized === 'object' && normalized.View && normalized.Text ? normalized : null;
      if (maybeReactNative) {
        overlayState.reactNative = maybeReactNative;
        bridgelessLog('react-native module detected', String(moduleId));
        if (!overlayState.appRegistry && maybeReactNative.AppRegistry) {
          overlayState.appRegistry = maybeReactNative.AppRegistry;
          patchAppRegistry(maybeReactNative.AppRegistry);
        }
      }
    }
    attemptOverlayInstallation('module:' + moduleId);
  }

  function huntForImportantModules() {
    var metroRequire = overlayState.originalRequire || g.__r;
    if (typeof metroRequire !== 'function') {
      return;
    }
    var scanned = overlayState.scannedModuleIds;
    if (!scanned) {
      scanned = Object.create(null);
      overlayState.scannedModuleIds = scanned;
    }
    var upperBound = 8192;
    for (var id = 0; id < upperBound; id++) {
      if (scanned[id]) {
        continue;
      }
      scanned[id] = true;
      var exports;
      try {
        exports = metroRequire(id);
      } catch (err) {
        continue;
      }
      inspectModuleCapture(id, exports);
      if (overlayState.react && overlayState.reactNative && overlayState.appRegistry) {
        return;
      }
    }
  }

  function installRequireHook() {
    if (overlayState.requireHookInstalled) {
      return;
    }
    var metroRequire = g.__r;
    if (typeof metroRequire !== 'function') {
      bridgelessLog('Require hook skipped', 'metro require unavailable');
      return;
    }
    if (metroRequire.__tweakRequirePatched) {
      overlayState.requireHookInstalled = true;
      overlayState.metroRequire = metroRequire;
      overlayState.originalRequire = metroRequire.__tweakOriginal || metroRequire;
      return;
    }
    var originalRequire = metroRequire;
    function patchedRequire(moduleId) {
      var result = originalRequire(moduleId);
      try {
        inspectModuleCapture(moduleId, result);
      } catch (err) {
        bridgelessLog('Module inspection failed', formatError(err));
      }
      return result;
    }
    try {
      Object.getOwnPropertyNames(originalRequire).forEach(function (key) {
        if (key === 'length' || key === 'name' || key === 'prototype') {
          return;
        }
        var descriptor = Object.getOwnPropertyDescriptor(originalRequire, key);
        if (descriptor) {
          try {
            Object.defineProperty(patchedRequire, key, descriptor);
          } catch (_) {}
        }
      });
    } catch (_) {}
    patchedRequire.__tweakRequirePatched = true;
    patchedRequire.__tweakOriginal = originalRequire;
    try {
      g.__r = patchedRequire;
    } catch (assignErr) {
      bridgelessLog('Require hook assignment failed', formatError(assignErr));
      return;
    }
    overlayState.requireHookInstalled = true;
    overlayState.originalRequire = originalRequire;
    overlayState.metroRequire = patchedRequire;
    bridgelessLog('metro require hook installed');
  }

  function scheduleOverlayRetry() {
    if (overlayState.retryTimer) {
      return;
    }
    var attempts = 0;
    overlayState.retryTimer = setInterval(function () {
      attempts += 1;
      try {
        captureFromGlobals();
        huntForImportantModules();
        attemptOverlayInstallation('retry-' + attempts);
        if (overlayState.overlayAnnouncementLogged) {
          clearInterval(overlayState.retryTimer);
          overlayState.retryTimer = null;
          return;
        }
      } catch (err) {
        bridgelessLog('Overlay retry error', formatError(err));
      }
      if (attempts >= 15 && overlayState.retryTimer) {
        clearInterval(overlayState.retryTimer);
        overlayState.retryTimer = null;
      }
    }, 1000);
  }

  installRequireHook();
  captureFromGlobals();
  huntForImportantModules();
  attemptOverlayInstallation('startup');
  scheduleOverlayRetry();

  bridgelessLog('minimal payload executed');

  setTimeout(function () {
    try {
      var requireInfo = describeRequire(g.__r);
      var modulesData = collectModulesSummary(g);
      var modulesInfo = modulesData.summary;
      var appRegistryInfo = inspectAppRegistry(g, g.__r, modulesData.container, modulesInfo);
      var globalKeysSummary = sampleGlobalKeys(g, 40);

      var envSnapshot = {
        timestamp: new Date().toISOString(),
        hasWindow: typeof g.window !== 'undefined',
        hasRequire: typeof g.__r === 'function',
        hasDefine: typeof g.__d === 'function',
        hasMetroRequire: typeof g.metroRequire === 'function',
        hasGlobalAppRegistry: typeof g.AppRegistry !== 'undefined',
        isDevMode: typeof g.__DEV__ !== 'undefined' ? !!g.__DEV__ : null,
        requireInfo: requireInfo,
        modulesSummary: modulesInfo,
        globalKeysSample: globalKeysSummary.sample,
        globalKeysTotalHint: globalKeysSummary.total
      };

      bridgelessLog('Environment snapshot', safeJson(envSnapshot));
      bridgelessLog('AppRegistry search', safeJson(appRegistryInfo));
    } catch (err) {
      bridgelessLog('Environment logging failed', formatError(err));
    }
  }, 2000);
})();
