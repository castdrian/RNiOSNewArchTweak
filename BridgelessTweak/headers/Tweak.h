#import <Foundation/Foundation.h>
#import <jsi/jsi.h>
#import <rootless.h>
#import <exception>
#import <memory>
#import <string>
#import <utility>
#import <vector>
#import <functional>

#import "Util.h"
#import "Logging.h"
#import "NativeInterop.h"

@interface RCTInstance : NSObject
- (void)callFunctionOnBufferedRuntimeExecutor:
    (std::function<void(facebook::jsi::Runtime &runtime)> &&)executor;
- (void)_loadJSBundle:(NSURL *)sourceURL;
- (void)registerSegmentWithId:(NSNumber *)segmentId path:(NSString *)path;
@end
