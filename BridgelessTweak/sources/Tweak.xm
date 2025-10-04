#import <Foundation/Foundation.h>
#import <jsi/jsi.h>
#include <memory>
#import <objc/runtime.h>
#import <rootless.h>
#include <string>
#include <utility>
#include <vector>

#define _LOG_PREFIX   "[Bridgeless]"
#define Log(fmt, ...) NSLog(@_LOG_PREFIX " " fmt, ##__VA_ARGS__)

@interface RCTInstance : NSObject
- (void)callFunctionOnBufferedRuntimeExecutor:
    (std::function<void(facebook::jsi::Runtime &runtime)> &&)executor;
- (void)_loadJSBundle:(NSURL *)sourceURL;
- (void)registerSegmentWithId:(NSNumber *)segmentId path:(NSString *)path;
@end

static BOOL sInjectedOnce = NO;

static NSString *ResourceBundlePath(void)
{
    static NSString       *sBundlePath = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        NSString *fsPath = ROOT_PATH_NS(@"/Library/Application Support/BridgelessResources.bundle");
        if ([[NSFileManager defaultManager] fileExistsAtPath:fsPath])
        {
            sBundlePath = fsPath;
            return;
        }
        NSURL    *mainBundleURL = [[NSBundle mainBundle] bundleURL];
        NSString *embedded =
            [[mainBundleURL path] stringByAppendingPathComponent:@"BridgelessResources.bundle"];
        if ([[NSFileManager defaultManager] fileExistsAtPath:embedded])
        {
            sBundlePath = embedded;
        }
    });
    return sBundlePath;
}

static NSBundle *ResourceBundle(void)
{
    static NSBundle       *sBundle = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        NSString *bundlePath = ResourceBundlePath();
        if (bundlePath.length == 0)
        {
            Log("Resource bundle path unavailable");
            return;
        }
        NSBundle *bundle = [NSBundle bundleWithPath:bundlePath];
        if (!bundle)
        {
            NSString *nested =
                [bundlePath stringByAppendingPathComponent:@"BridgelessResources.bundle"];
            bundle = [NSBundle bundleWithPath:nested];
            if (bundle)
                Log("Using nested resource bundle at %@", nested);
            else
                Log("Failed to create resource bundle at %@", bundlePath);
        }
        sBundle = bundle;
    });
    return sBundle;
}

static std::shared_ptr<std::string> LoadPayloadSource(void)
{
    static dispatch_once_t              onceToken;
    static std::shared_ptr<std::string> sSource;
    dispatch_once(&onceToken, ^{
        NSBundle *bundle = ResourceBundle();
        if (!bundle)
        {
            Log("Resource bundle unavailable for payload");
            return;
        }

        NSString *scriptPath = [bundle pathForResource:@"script" ofType:@"js"];
        if (!scriptPath)
        {
            Log("script.js not found in resource bundle");
            return;
        }

        NSError *err  = nil;
        NSData  *data = [NSData dataWithContentsOfFile:scriptPath options:0 error:&err];
        if (!data || data.length == 0)
        {
            Log("Failed reading script.js: %@", err);
            return;
        }

        sSource = std::make_shared<std::string>((const char *) data.bytes, (size_t) data.length);
        Log("Loaded script.js (%lu bytes)", (unsigned long) data.length);
    });
    return sSource;
}

namespace {

struct BytecodeBuffer final : public facebook::jsi::Buffer {
    explicit BytecodeBuffer(std::shared_ptr<std::vector<uint8_t>> bytes) : bytes_(std::move(bytes))
    {
    }

    size_t size() const override
    {
        return bytes_ ? bytes_->size() : 0;
    }

    const uint8_t *data() const override
    {
        return bytes_ && !bytes_->empty() ? bytes_->data() : nullptr;
    }

private:
    std::shared_ptr<std::vector<uint8_t>> bytes_;
};

} // namespace

static std::shared_ptr<std::vector<uint8_t>> LoadPayloadBytecode(void)
{
    static dispatch_once_t                       onceToken;
    static std::shared_ptr<std::vector<uint8_t>> sBytecode;
    dispatch_once(&onceToken, ^{
        NSBundle *bundle = ResourceBundle();
        if (!bundle)
        {
            return;
        }

        NSString *path = [bundle pathForResource:@"script" ofType:@"bundle"];
        if (!path)
        {
            return;
        }

        NSError *err  = nil;
        NSData  *data = [NSData dataWithContentsOfFile:path options:0 error:&err];
        if (!data || data.length == 0)
        {
            Log("Failed reading script.bundle: %@", err);
            return;
        }

        auto vec = std::make_shared<std::vector<uint8_t>>(
            (const uint8_t *) data.bytes, (const uint8_t *) data.bytes + data.length);
        sBytecode = std::move(vec);
        Log("Loaded script.bundle (%lu bytes)", (unsigned long) data.length);
    });
    return sBytecode;
}

static void EvaluatePayload(facebook::jsi::Runtime                      &rt,
                            const std::shared_ptr<std::string>          &jsSource,
                            const std::shared_ptr<std::vector<uint8_t>> &bytecode)
{
    if (sInjectedOnce)
    {
        return;
    }

    sInjectedOnce = YES;

    bool executed = false;

    if (bytecode && !bytecode->empty())
    {
        try
        {
            auto buffer   = std::make_shared<BytecodeBuffer>(bytecode);
            auto prepared = rt.prepareJavaScript(buffer, "bridgeless/script.bundle");
            rt.evaluatePreparedJavaScript(prepared);
            Log("script.bundle evaluated via runtime");
            executed = true;
        }
        catch (const facebook::jsi::JSError &err)
        {
            Log("Bytecode JSI error: %s", err.getMessage().c_str());
        }
        catch (const std::exception &ex)
        {
            Log("Bytecode std::exception: %s", ex.what());
        }
        catch (...)
        {
            Log("Unknown exception evaluating script.bundle");
        }
    }

    if (!executed && jsSource && !jsSource->empty())
    {
        try
        {
            auto buffer = std::make_unique<facebook::jsi::StringBuffer>(*jsSource);
            rt.evaluateJavaScript(std::move(buffer), "bridgeless/script.js");
            Log("script.js evaluated via runtime");
            executed = true;
        }
        catch (const facebook::jsi::JSError &err)
        {
            Log("JSI error: %s", err.getMessage().c_str());
        }
        catch (const std::exception &ex)
        {
            Log("std::exception: %s", ex.what());
        }
        catch (...)
        {
            Log("Unknown exception evaluating script.js");
        }
    }

    if (!executed)
    {
        Log("Payload evaluation skipped (no resources available)");
    }
}

static void EnqueuePayload(RCTInstance *instance)
{
    if (!instance || sInjectedOnce)
    {
        return;
    }

    auto jsSource = LoadPayloadSource();
    auto bytecode = LoadPayloadBytecode();
    if ((!jsSource || jsSource->empty()) && (!bytecode || bytecode->empty()))
    {
        Log("No payload resources available");
        return;
    }

    Log("Scheduling payload execution");

    [instance
        callFunctionOnBufferedRuntimeExecutor:std::function<void(facebook::jsi::Runtime &)>(
                                                  [jsSource, bytecode](facebook::jsi::Runtime &rt) {
                                                      EvaluatePayload(rt, jsSource, bytecode);
                                                  })];
}

static BOOL TryRegisterSegment(RCTInstance *instance)
{
    NSBundle *bundle = ResourceBundle();
    if (!bundle)
    {
        Log("Resource bundle unavailable for segment registration");
        return NO;
    }

    NSString *path = [bundle pathForResource:@"script" ofType:@"bundle"];
    if (path.length == 0)
    {
        Log("script.bundle unavailable; skipping segment registration");
        return NO;
    }

    if (![[NSFileManager defaultManager] fileExistsAtPath:path])
    {
        Log("script.bundle missing at %@", path);
        return NO;
    }

    static const uint32_t kSegmentId = 0x5EB1D1;
    [instance registerSegmentWithId:@(kSegmentId) path:path];
    Log("Registered script.bundle as segment id %u", (unsigned) kSegmentId);
    sInjectedOnce = YES;
    return YES;
}

static void WaitForBundleAndInject(RCTInstance *instance)
{
    if (!instance || sInjectedOnce)
    {
        return;
    }

    static id sBundleObserver = nil;
    if (sBundleObserver)
    {
        return;
    }

    __weak RCTInstance *weakInstance = instance;
    sBundleObserver                  = [[NSNotificationCenter defaultCenter]
        addObserverForName:@"RCTInstanceDidLoadBundle"
                    object:nil
                     queue:nil
                usingBlock:^(NSNotification *note) {
                    [[NSNotificationCenter defaultCenter] removeObserver:sBundleObserver];
                    sBundleObserver = nil;

                    __strong RCTInstance *strongInstance = weakInstance;
                    if (!strongInstance)
                    {
                        Log("Bundle notification received but instance deallocated");
                        return;
                    }

                    if (!TryRegisterSegment(strongInstance))
                    {
                        EnqueuePayload(strongInstance);
                    }
                }];

    Log("Registered for RCTInstanceDidLoadBundle notification");
}

%hook RCTInstance

- (void)_loadJSBundle:(NSURL *)sourceURL
{
    %orig(sourceURL);
    WaitForBundleAndInject(self);
}
%end

%ctor
{
    Log("Tweak initialized");
}
