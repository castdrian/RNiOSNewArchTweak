#import "NativeInterop.h"

using namespace facebook;
using namespace facebook::jsi;

namespace bridgeless {
namespace {

static constexpr const char *GLOBAL_NAME = "__bridgelessNative";
static constexpr const char *SYSTEM_VERSION_PROP = "systemVersion";

Value systemVersionHostFunction(Runtime &runtime,
                                const Value &thisValue,
                                const Value *arguments,
                                size_t count)
{
    (void) thisValue;
    (void) arguments;
    (void) count;
    @autoreleasepool {
        NSString *version = [UIDevice currentDevice].systemVersion ?: @"";
        Log(@"systemVersion() called -> %@", version);
        const char *utf8 = [version UTF8String];
        std::string cppVersion = utf8 ? utf8 : "";
        return String::createFromUtf8(runtime, cppVersion);
    }
}
}  // namespace

void registerNativeInterop(Runtime &runtime)
{
    auto hostFunction = Function::createFromHostFunction(
        runtime,
        PropNameID::forUtf8(runtime, SYSTEM_VERSION_PROP),
        0,
        systemVersionHostFunction);

    Object interop(runtime);
    interop.setProperty(runtime, SYSTEM_VERSION_PROP, std::move(hostFunction));

    runtime.global().setProperty(runtime, GLOBAL_NAME, std::move(interop));
    Log(@"Interop installed on runtime");
}
}  // namespace bridgeless
