#import <Foundation/Foundation.h>
#import <jsi/jsi.h>
#import <memory>
#import <objc/runtime.h>
#import <rootless.h>
#import <string>
#import <utility>
#import <vector>

#import "NativeInterop.h"
#import "Tweak.h"

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
    explicit BytecodeBuffer(std::shared_ptr<std::vector<uint8_t>> bytes) : bytes_(std::move(bytes)) {}
    size_t size() const override { return bytes_ ? bytes_->size() : 0; }
    const uint8_t *data() const override
    {
        return bytes_ && !bytes_->empty() ? bytes_->data() : nullptr;
    }
private:
    std::shared_ptr<std::vector<uint8_t>> bytes_;
};

}

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
                                   const std::shared_ptr<std::vector<uint8_t>> &bytecode,
                                   const std::shared_ptr<std::string>          &jsSource)
{
    if (sInjectedOnce)
    {
        return;
    }
    sInjectedOnce = YES;

    bridgeless::RegisterNativeInterop(rt);

    bool executed = false;

    if (bytecode && !bytecode->empty())
    {
        try
        {
            auto buffer   = std::make_shared<BytecodeBuffer>(bytecode);
            auto prepared = rt.prepareJavaScript(buffer, "script.bundle");
            rt.evaluatePreparedJavaScript(prepared);
            Log("Executed script.bundle via prepared bytecode");
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
            rt.evaluateJavaScript(std::move(buffer), "script.js");
            Log("Executed script.js (raw source)");
            executed = true;
        }
        catch (const facebook::jsi::JSError &err)
        {
            Log("JS source JSI error: %s", err.getMessage().c_str());
        }
        catch (const std::exception &ex)
        {
            Log("JS source std::exception: %s", ex.what());
        }
        catch (...)
        {
            Log("Unknown exception evaluating script.js");
        }
    }

    if (!executed)
    {
        Log("No payload executed (no valid bytecode or source)");
    }
}

static void InjectPayload(RCTInstance *instance)
{
    if (!instance || sInjectedOnce)
    {
        return;
    }

    auto bytecode = LoadPayloadBytecode();
    auto jsSource = LoadPayloadSource();

    if ((!bytecode || bytecode->empty()) && (!jsSource || jsSource->empty()))
    {
        Log("No payload artifacts (hbc bundle or js) available");
        return;
    }

    Log("Scheduling payload injection");
    [instance callFunctionOnBufferedRuntimeExecutor:
                  std::function<void(facebook::jsi::Runtime &)>(
                      [bytecode, jsSource](facebook::jsi::Runtime &rt) {
                          EvaluatePayload(rt, bytecode, jsSource);
                      })];
}

%hook RCTInstance
- (void)_loadJSBundle:(NSURL *)sourceURL
{
    InjectPayload(self);
    %orig(sourceURL);
}
%end

%ctor
{
    Log("Tweak initialized");
}
