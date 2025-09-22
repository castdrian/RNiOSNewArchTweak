; (function () {
	var g = typeof globalThis !== 'undefined' ? globalThis : this;
	if (g.__BRIDGELESS_PAYLOAD_INSTALLED__) return;
	g.__BRIDGELESS_PAYLOAD_INSTALLED__ = true;

	function log(msg, lvl) {
		try {
			var sev = typeof lvl === 'number' ? lvl : 0;
			if (typeof g.__nativeLog === 'function') g.__nativeLog('[Bridgeless] ' + String(msg), sev);
			else if (g.console && g.console.log) g.console.log('[Bridgeless] ' + String(msg));
		} catch (_) { }
	}
	function warn(m) { log(m, 1) } function error(m) { log(m, 2) }

	function getRequire() {
		if (typeof g.__r === 'function') return g.__r;
		var p = g.__METRO_GLOBAL_PREFIX__;
		if (p && g[p] && typeof g[p].__r === 'function') return g[p].__r;
		if (typeof g.metroRequire === 'function') return g.metroRequire;
		return null;
	}

	try {
		var __r = getRequire();
		if (!__r) { warn('__r not available; skipping'); return; }

		var RN = null, React = null;
		try { RN = __r('react-native'); } catch (eRN) { warn('require("react-native") failed: ' + eRN); }
		try { React = __r('react'); } catch (eR) { warn('require("react") failed: ' + eR); }

		if (!RN || !React) { warn('React or RN not available; skipping'); return; }

		var AppRegistry = RN.AppRegistry;
		if (!AppRegistry || typeof AppRegistry.setWrapperComponentProvider !== 'function') {
			try {
				var arMod = __r('react-native/Libraries/ReactNative/AppRegistry');
				AppRegistry = (arMod && arMod.AppRegistry) || (arMod && arMod.default) || AppRegistry;
			} catch (_) { }
		}
		if (!AppRegistry || typeof AppRegistry.setWrapperComponentProvider !== 'function') {
			warn('AppRegistry wrapper API unavailable; skipping'); return;
		}

		var View = RN.View, Text = RN.Text, StyleSheet = RN.StyleSheet;
		var styles = StyleSheet && StyleSheet.create ? StyleSheet.create({
			root: { flex: 1 },
			strip: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: '#102539' },
			inner: { padding: 10 },
			title: { color: '#7affea', fontWeight: '700' },
			sub: { color: '#b8c7ff' }
		}) : {
			root: { flex: 1 }, strip: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: '#102539' },
			inner: { padding: 10 }, title: { color: '#7affea', fontWeight: '700' }, sub: { color: '#b8c7ff' }
		};

		function Overlay(props) {
			try {
				return React.createElement(
					React.Fragment, null,
					React.createElement(View, { style: styles.root }, props && props.children),
					React.createElement(View, { style: styles.strip },
						React.createElement(View, { style: styles.inner },
							React.createElement(Text, { style: styles.title }, 'Bridgeless overlay active'),
							React.createElement(Text, { style: styles.sub }, 'Injected after RN bootstrapped'))));
			} catch (e) {
				warn('Overlay render failed: ' + e);
				return (props && props.children) || null;
			}
		}
		Overlay.displayName = 'UnboundOverlay';

		AppRegistry.setWrapperComponentProvider(function () { return Overlay; });
		log('Wrapper provider installed');
	} catch (fatal) {
		error('script.js fatal: ' + (fatal && (fatal.stack || fatal.message || fatal)));
	}
})();