#import <Foundation/Foundation.h>
#import <objc/runtime.h>
#import <rootless.h>
#import <jsi/jsi.h>

#define UB_LOG_PREFIX   "[Bridgeless]"
#define UBLog(fmt, ...) NSLog(@UB_LOG_PREFIX " " fmt, ##__VA_ARGS__)

@interface RCTInstance : NSObject
- (void)callFunctionOnBufferedRuntimeExecutor:(std::function<void(facebook::jsi::Runtime &runtime)> &&)executor;
@end

@interface RCTHost : NSObject @end

static BOOL sInjectedOnce = NO;

static NSString *UBResourceBundlePath(void) {
  static NSString *sBundlePath = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    NSString *fsPath = ROOT_PATH_NS(@"/Library/Application Support/BridgelessResources.bundle");
    if ([[NSFileManager defaultManager] fileExistsAtPath:fsPath]) { sBundlePath = fsPath; return; }
    NSURL *mainBundleURL = [[NSBundle mainBundle] bundleURL];
    NSString *embedded = [[mainBundleURL path] stringByAppendingPathComponent:@"BridgelessResources.bundle"];
    if ([[NSFileManager defaultManager] fileExistsAtPath:embedded]) { sBundlePath = embedded; }
  });
  return sBundlePath;
}

static NSBundle *UBResourceBundle(void) {
  static NSBundle *sBundle = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    NSString *bundlePath = UBResourceBundlePath();
    if (bundlePath.length == 0) { UBLog("Resource bundle path unavailable"); return; }
    NSBundle *bundle = [NSBundle bundleWithPath:bundlePath];
    if (!bundle) {
      NSString *nested = [bundlePath stringByAppendingPathComponent:@"BridgelessResources.bundle"];
      bundle = [NSBundle bundleWithPath:nested];
      if (bundle) UBLog("Using nested resource bundle at %@", nested);
      else UBLog("Failed to create resource bundle at %@", bundlePath);
    }
    sBundle = bundle;
  });
  return sBundle;
}

static NSData *UBLoadPayloadJS(void) {
  NSBundle *bundle = UBResourceBundle();
  if (!bundle) { UBLog("Resource bundle unavailable for payload"); return nil; }
  NSString *path = [bundle pathForResource:@"script" ofType:@"js"];
  if (!path) { UBLog("script.js not found in resource bundle"); return nil; }
  NSError *err = nil;
  NSString *js = [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:&err];
  if (!js || js.length == 0) { UBLog("Failed reading script.js: %@", err); return nil; }
  return [js dataUsingEncoding:NSUTF8StringEncoding];
}

static RCTInstance *UBGetRCTInstanceFromHost(id host) {
  Ivar ivar = class_getInstanceVariable([host class], "_instance");
  if (!ivar) { UBLog("RCTHost _instance ivar not found (API mismatch)"); return nil; }
  return (RCTInstance *)object_getIvar(host, ivar);
}

static void UBInjectJSOnce(RCTInstance *instance) {
  if (!instance || sInjectedOnce) return;

  NSData *payload = UBLoadPayloadJS();
  if (!payload) return;

  std::string code((const char *)payload.bytes, (size_t)payload.length);

  // Queue AFTER %orig(createSurface...), on the same BufferedRuntimeExecutor
  [instance callFunctionOnBufferedRuntimeExecutor:std::function<void(facebook::jsi::Runtime &)>([code = std::move(code)](facebook::jsi::Runtime &rt) {
    try {
      auto buf = std::make_unique<facebook::jsi::StringBuffer>(code);
      rt.evaluateJavaScript(std::move(buf), "unbound-bridgeless-postbundle.js");
    } catch (const facebook::jsi::JSError &e) {
      UBLog("JSI error: %s", e.getMessage().c_str());
    } catch (const std::exception &ex) {
      UBLog("std::exception: %s", ex.what());
    } catch (...) {
      UBLog("unknown exception evaluating script.js");
    }
  })];

  sInjectedOnce = YES;
  UBLog("script.js evaluated (post-bundle via buffered executor)");
}

%hook RCTHost

- (id)createSurfaceWithModuleName:(NSString *)moduleName
                             mode:(int)displayMode
                initialProperties:(NSDictionary *)props
{
  id ret = %orig(moduleName, displayMode, props);
  UBInjectJSOnce(UBGetRCTInstanceFromHost(self));
  return ret;
}

- (id)createSurfaceWithModuleName:(NSString *)moduleName
                initialProperties:(NSDictionary *)props
{
  id ret = %orig(moduleName, props);
  UBInjectJSOnce(UBGetRCTInstanceFromHost(self));
  return ret;
}

%end

%ctor { UBLog("Tweak initialized"); }