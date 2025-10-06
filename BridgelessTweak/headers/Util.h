#import <Foundation/Foundation.h>
#import <rootless.h>

#import "Logging.h"

NS_ASSUME_NONNULL_BEGIN

@interface Util : NSObject

+ (nullable NSData *)
    payloadDataWithExtension:(NSString *_Nullable __autoreleasing *_Nullable)outExtension;

@end

NS_ASSUME_NONNULL_END
