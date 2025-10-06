#import "RCTNativeTestModule.h"
#import "NativeTestModuleSpecJSI.h"
#import <UIKit/UIKit.h>

using namespace facebook::react;

@implementation RCTNativeTestModule

RCT_EXPORT_MODULE(NativeTestModule);

- (NSString *)systemVersion
{
  return UIDevice.currentDevice.systemVersion ?: @"";
}

- (std::shared_ptr<TurboModule>)getTurboModule:(const ObjCTurboModule::InitParams &)params
{
  return std::make_shared<NativeTestModuleSpecJSI>(params);
}

@end
