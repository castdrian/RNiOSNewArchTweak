#import "Tweak.h"

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

static bool runBytecode(facebook::jsi::Runtime                      &runtime,
                        const std::shared_ptr<std::vector<uint8_t>> &bytecode)
{
    if (!bytecode || bytecode->empty())
    {
        return false;
    }

    try
    {
        auto buffer   = std::make_shared<BytecodeBuffer>(bytecode);
        auto prepared = runtime.prepareJavaScript(buffer, "script.bundle");
        runtime.evaluatePreparedJavaScript(prepared);
        Log("Executed script.bundle");
        return true;
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

    return false;
}

static bool runSource(facebook::jsi::Runtime &runtime, const std::shared_ptr<std::string> &source)
{
    if (!source || source->empty())
    {
        return false;
    }

    try
    {
        auto buffer = std::make_unique<facebook::jsi::StringBuffer>(*source);
        runtime.evaluateJavaScript(std::move(buffer), "script.js");
        Log("Executed script.js");
        return true;
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

    return false;
}

static void executePayload(facebook::jsi::Runtime                      &runtime,
                           const std::shared_ptr<std::vector<uint8_t>> &bytecode,
                           const std::shared_ptr<std::string>          &source)
{
    bridgeless::registerNativeInterop(runtime);

    if (runBytecode(runtime, bytecode))
    {
        return;
    }

    if (runSource(runtime, source))
    {
        return;
    }

    Log("No payload executed (no valid bytecode or javascript)");
}

} // namespace

static void injectPayload(RCTInstance *instance)
{
    if (!instance)
    {
        return;
    }

    NSString *payloadExtension = nil;
    NSData   *payloadData      = [Util payloadDataWithExtension:&payloadExtension];
    if (!payloadData || payloadData.length == 0 || payloadExtension.length == 0)
    {
        Log("No payload data available");
        return;
    }

    std::shared_ptr<std::vector<uint8_t>> bytecode;
    std::shared_ptr<std::string>          source;

    if ([payloadExtension isEqualToString:@"bundle"])
    {
        const auto *bytes  = static_cast<const uint8_t *>(payloadData.bytes);
        const auto  length = static_cast<size_t>(payloadData.length);
        bytecode           = std::make_shared<std::vector<uint8_t>>(bytes, bytes + length);
    }
    else if ([payloadExtension isEqualToString:@"js"])
    {
        const auto *bytes  = static_cast<const char *>(payloadData.bytes);
        const auto  length = static_cast<size_t>(payloadData.length);
        source             = std::make_shared<std::string>(bytes, bytes + length);
    }
    else
    {
        Log("Unsupported payload extension: %@", payloadExtension);
        return;
    }

    [instance
        callFunctionOnBufferedRuntimeExecutor:std::function<void(facebook::jsi::Runtime &)>(
                                                  [bytecode,
                                                   source](facebook::jsi::Runtime &runtime) {
                                                      executePayload(runtime, bytecode, source);
                                                  })];
}

%hook RCTInstance
- (void)_loadJSBundle:(NSURL *)sourceURL
{
    injectPayload(self);
    %orig(sourceURL);
}
%end

%ctor
{
    Log("Tweak initialized");
}
