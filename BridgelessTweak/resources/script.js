; (function () {
	var g = typeof globalThis !== 'undefined' ? globalThis : this;

	var state = {
		reactNative: null,
		alertShown: false,
		requireHookInstalled: false,
		scanned: Object.create(null),
		turboModule: null
	};

	function log(msg) {
		try {
			if (typeof g.__nativeLog === 'function') {
				g.__nativeLog('[Bridgeless] ' + msg, 0);
			} else if (g.console && typeof g.console.log === 'function') {
				g.console.log('[Bridgeless] ' + msg);
			}
		} catch (_) { }
	}

	function normalizeModule(value) {
		if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
			return value;
		}
		if (value.__esModule && value.default) {
			return value.default;
		}
		if ('default' in value && value.default) {
			return value.default;
		}
		return value;
	}

	function getAlertModule(rn) {
		if (!rn) {
			return null;
		}
		if (rn.Alert && typeof rn.Alert.alert === 'function') {
			return rn.Alert;
		}
		if (rn.default && rn.default.Alert && typeof rn.default.Alert.alert === 'function') {
			return rn.default.Alert;
		}
		return null;
	}

	function getTurboModuleRegistry(rn) {
		if (!rn) {
			return null;
		}
		var registry = null;
		try {
			if (rn.TurboModuleRegistry && typeof rn.TurboModuleRegistry.get === 'function') {
				registry = rn.TurboModuleRegistry;
			} else if (rn.TurboModuleRegistry && rn.TurboModuleRegistry.default && typeof rn.TurboModuleRegistry.default.get === 'function') {
				registry = rn.TurboModuleRegistry.default;
			} else if (typeof rn.__turboModuleProxy === 'function') {
				registry = { get: rn.__turboModuleProxy };
			} else if (typeof g.__turboModuleProxy === 'function') {
				registry = { get: g.__turboModuleProxy };
			}
		} catch (_) { }
		return registry;
	}

	function getNativeModule(rn, names) {
		if (!rn || !names || !names.length) {
			return null;
		}
		var nativeModules = null;
		try {
			nativeModules = rn.NativeModules || (rn.default && rn.default.NativeModules);
		} catch (_) { }
		if (nativeModules && typeof nativeModules === 'object') {
			for (var i = 0; i < names.length; i++) {
				var maybeModule = nativeModules[names[i]];
				if (maybeModule) {
					return maybeModule;
				}
			}
		}
		var turboModuleRegistry = getTurboModuleRegistry(rn);
		if (turboModuleRegistry && typeof turboModuleRegistry.get === 'function') {
			for (var j = 0; j < names.length; j++) {
				try {
					var turboModule = turboModuleRegistry.get(names[j]);
					if (turboModule) {
						return turboModule;
					}
				} catch (_) { }
			}
		}
		return null;
	}

	function getTestTurboModule() {
		if (!state.reactNative) {
			return null;
		}
		if (state.turboModule) {
			return state.turboModule;
		}
		var module = null;
		try {
			module = getNativeModule(state.reactNative, ['NativeTestModule']);
		} catch (_) { }
		if (module) {
			state.turboModule = module;
		}
		return module;
	}

	function tryShowAlert(reason) {
		if (state.alertShown) {
			return true;
		}
		var alertModule = getAlertModule(state.reactNative);
		if (!alertModule) {
			return false;
		}
		try {
			var baseMessage = 'alert called from javascript using react native';
			var message = baseMessage;
			var testTurboModule = null;
			try {
				testTurboModule = getTestTurboModule();
			} catch (_) { }
			if (testTurboModule) {
				var systemVersion = null;
				try {
					systemVersion = testTurboModule.systemVersion;
					if (typeof systemVersion === 'function') {
						systemVersion = systemVersion();
					}
				} catch (_) { }
				if (systemVersion != null) {
					message = baseMessage + ' (iOS ' + String(systemVersion) + ')';
				} else {
					message = 'NativeTestModule.systemVersion unavailable';
				}
			} else {
				message = 'NativeTestModule not found';
			}
			alertModule.alert('bridgeless tweak', message);
			state.alertShown = true;
			log('Alert displayed (' + reason + '): ' + message);
			return true;
		} catch (err) {
			log('Alert failed: ' + String(err && err.message ? err.message : err));
			return false;
		}
	}

	function inspectModule(moduleId, moduleExports) {
		if (state.alertShown) {
			return;
		}
		if (state.scanned[moduleId]) {
			return;
		}
		state.scanned[moduleId] = true;

		var normalized = normalizeModule(moduleExports);
		if (!state.reactNative && normalized && typeof normalized === 'object' && normalized.Alert) {
			state.reactNative = normalized;
		}
		tryShowAlert('module:' + moduleId);
	}

	function installRequireHook() {
		if (state.requireHookInstalled) {
			return;
		}
		var metroRequire = g.__r;
		if (typeof metroRequire !== 'function') {
			return;
		}
		if (metroRequire.__bridgelessAlertHooked) {
			state.requireHookInstalled = true;
			return;
		}

		function patchedRequire(moduleId) {
			var result = metroRequire(moduleId);
			try {
				inspectModule(moduleId, result);
			} catch (_) { }
			return result;
		}

		try {
			Object.getOwnPropertyNames(metroRequire).forEach(function (key) {
				if (key === 'length' || key === 'name' || key === 'prototype') {
					return;
				}
				var descriptor = Object.getOwnPropertyDescriptor(metroRequire, key);
				if (descriptor) {
					try {
						Object.defineProperty(patchedRequire, key, descriptor);
					} catch (_) { }
				}
			});
		} catch (_) { }

		patchedRequire.__bridgelessAlertHooked = true;
		try {
			g.__r = patchedRequire;
			state.requireHookInstalled = true;
			log('require hook installed');
		} catch (err) {
			log('require hook failed: ' + String(err && err.message ? err.message : err));
		}
	}

	function getModules() {
		if (typeof g.__r !== 'function') {
			return;
		}
		for (var id = 0; id < 4096 && !state.alertShown; id++) {
			try {
				var exports = g.__r(id);
				inspectModule(id, exports);
			} catch (_) { }
		}
	}

	function tick() {
		if (state.alertShown) {
			if (state.retryTimer) {
				clearInterval(state.retryTimer);
				state.retryTimer = null;
			}
			return;
		}
		installRequireHook();
		getModules();
		tryShowAlert('tick');
	}

	installRequireHook();
	getModules();
	if (!tryShowAlert('startup') && !state.alertShown) {
		state.retryTimer = setInterval(tick, 500);
	}
})();
