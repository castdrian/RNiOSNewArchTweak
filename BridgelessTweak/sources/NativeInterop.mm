#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

#import "NativeInterop.h"

#define INTEROP_LOG(fmt, ...) NSLog(@"[Bridgeless][Interop] " fmt, ##__VA_ARGS__)

using namespace facebook;
using namespace facebook::jsi;

namespace bridgeless {
namespace {

static constexpr const char *kGlobalName = "__bridgelessNative";
static constexpr const char *kSystemVersionProp = "systemVersion";

Value SystemVersionHostFunction(Runtime &runtime,
                                const Value &thisValue,
                                const Value *arguments,
                                size_t count)
{
    (void) thisValue;
    (void) arguments;
    (void) count;
    @autoreleasepool {
        NSString *version = [UIDevice currentDevice].systemVersion ?: @"";
        INTEROP_LOG(@"systemVersion() called -> %@", version);
        const char *utf8 = [version UTF8String];
        std::string cppVersion = utf8 ? utf8 : "";
        return String::createFromUtf8(runtime, cppVersion);
    }
}

bool ShouldInstall(Runtime &runtime)
{
    if (!runtime.global().hasProperty(runtime, kGlobalName))
    {
        return true;
    }
    auto existing = runtime.global().getProperty(runtime, kGlobalName);
    return existing.isUndefined() || existing.isNull();
}

}

void RegisterNativeInterop(Runtime &runtime)
{
    if (!ShouldInstall(runtime))
    {
        INTEROP_LOG(@"Interop already installed");
        return;
    }

    auto hostFunction = Function::createFromHostFunction(
        runtime,
        PropNameID::forUtf8(runtime, kSystemVersionProp),
        0,
        SystemVersionHostFunction);

    Object interop(runtime);
    interop.setProperty(runtime, kSystemVersionProp, std::move(hostFunction));

    runtime.global().setProperty(runtime, kGlobalName, std::move(interop));
    INTEROP_LOG(@"Interop installed on runtime");
}

}
