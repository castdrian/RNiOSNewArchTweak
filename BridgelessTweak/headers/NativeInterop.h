#pragma once

#import <jsi/jsi.h>

namespace bridgeless {

void RegisterNativeInterop(facebook::jsi::Runtime &runtime);

}

#define INTEROP_LOG(fmt, ...) NSLog(@"[Bridgeless][Interop] " fmt, ##__VA_ARGS__)
