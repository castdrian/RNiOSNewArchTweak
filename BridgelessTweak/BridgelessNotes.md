# Bridgeless Injection Notes

## Goal

- Inject Unbound’s JavaScript bundle into React Native apps that run in the new architecture / bridgeless mode.
- Leave the legacy `RCTCxxBridge` hook solely for native module registration; all JS patching must work without the old bridge.

- Hook `RCTInstance::_loadJSBundle`, `_loadScriptFromSource:` and `loadJSWithSourceCode:sourceURL:` to schedule a single runtime-level `RuntimeExecutor` evaluation once Hermes is ready.  The executor now prefers `/Library/Application Support/BridgelessResources.bundle/script.bundle` (Hermes bytecode) and falls back to `script.js` (with `injection.*` as legacy aliases) if the binary build is unavailable.
- Resource access mirrors the existing `Utilities` helpers: we resolve the bundle once via `NSBundle bundleWithPath:` and stream resources via `pathForResource`. Nested bundle fallback is still in place for older packages, and logging includes the byte-size and selected resource name.
- Runtime scheduling piggybacks on the app’s own `callFunctionOnBufferedRuntimeExecutor:` invocations. Once `_loadJSBundle` fires we mark an injection as pending; the first runtime job we see gets wrapped so our payload executes before delegating to React. Verbose logging keeps track of state transitions.
- JavaScript payload is currently in diagnostics mode: it installs a fatal-error hook, attempts a native alert, and then logs what bridgeless globals are available (`__r`, Metro module counts, sample module descriptors, global keys, etc.) without touching AppRegistry so we can inspect the environment without destabilising the runtime.
- `make package` now compiles `resources/script.js` into a Hermes bytecode bundle via the local `hermesc` binary when available; the binary is packaged alongside the plain script for fallback/debugging.

## Attempts That Failed / Lessons Learned

- **Prepending/appending bytes:** Modifying the Hermes bytecode bundle with raw JS does nothing because the runtime ignores trailing text. Runtime evaluation via JSI is required.
- **`callFunctionOnBufferedRuntimeExecutor` crash (earlier attempt):** Resolved by deferring scheduling until the first `_loadJSBundle`/`_loadScriptFromSource:` and guarding against missing scripts/selectors.
- **Direct Objective-C++ call into `callFunctionOnBufferedRuntimeExecutor`:** Invoking the selector via a typed interface caused an immediate startup crash.
- **Manually dispatching via `objc_msgSend`:** Also resulted in boot-time crashes on device. Wrapping the runtime job when React calls into the executor proved stable.
- **Direct AppRegistry mutation (getAppKeys/getRunnable):** Injecting by re-registering the first runnable component via `AppRegistry.registerComponent` had no visible effect in bridgeless mode.
- **String-based `require('react')` / `require('react-native')`:** Works with Metro but fails against Hermes bytecode bundles; the payload now scans `__r.getModules()` to locate the modules without triggering fatal unknown-module errors.
- **Inline NSString payload:** Encoding the payload as a giant literal produced quoting/newline build failures.  The script now lives as a resource file and is streamed into the bundle at runtime.

## Diagnostics / Logging

- `_loadJSBundle`, `_loadScriptFromSource`, `loadJSWithSourceCode`, and fallback `executeApplicationScript` all log byte counts when they fire.
- Resource loader logs whether the script was found (including nested bundle paths).
- Runtime scheduler logs whether the executor was invoked, and whether the script executed or threw an exception.

## Next Checks

- Confirm the executor log (`Runtime injection executed`) appears; if not, inspect the preceding warnings to see whether the resource bundle or selector lookup failed.
- Validate that the native alert shows on launch; once stable, observe whether delayed wrapper retries succeed once React/ReactNative surface in the module registry.
