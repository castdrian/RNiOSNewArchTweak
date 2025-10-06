#import <Foundation/Foundation.h>
#define Log(fmt, ...) NSLog(@"[Bridgeless] " fmt, ##__VA_ARGS__)

@interface RCTInstance : NSObject
- (void)callFunctionOnBufferedRuntimeExecutor:
    (std::function<void(facebook::jsi::Runtime &runtime)> &&)executor;
- (void)_loadJSBundle:(NSURL *)sourceURL;
- (void)registerSegmentWithId:(NSNumber *)segmentId path:(NSString *)path;
@end
