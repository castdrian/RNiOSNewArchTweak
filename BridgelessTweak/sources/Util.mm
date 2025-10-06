#import "Util.h"

@implementation Util

+ (NSString *)resourceBundlePath
{
    static NSString       *cachedPath = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        NSArray<NSString *> *candidatePaths = @[
            ROOT_PATH_NS(@"/Library/Application Support/BridgelessResources.bundle"),
            [[[NSBundle mainBundle] bundlePath]
                stringByAppendingPathComponent:@"BridgelessResources.bundle"],
        ];

        NSFileManager *fileManager = [NSFileManager defaultManager];
        for (NSString *path in candidatePaths)
        {
            if ([fileManager fileExistsAtPath:path])
            {
                cachedPath = path;
                Log("Using resource bundle at %@", path);
                break;
            }
        }

        if (!cachedPath)
        {
            Log("Resource bundle not found at expected locations");
        }
    });
    return cachedPath;
}

+ (nullable NSData *)payloadDataWithExtension:(NSString *__autoreleasing _Nullable *)outExtension
{
    NSString *bundlePath = [self resourceBundlePath];
    if (bundlePath.length == 0)
    {
        return nil;
    }

    NSBundle *bundle = [NSBundle bundleWithPath:bundlePath];
    if (!bundle)
    {
        Log("Failed to open resource bundle at %@", bundlePath);
        return nil;
    }

    NSArray<NSString *> *extensions  = @[ @"bundle", @"js" ];
    NSFileManager       *fileManager = [NSFileManager defaultManager];

    for (NSString *extension in extensions)
    {
        NSString *resourcePath = [bundle pathForResource:@"script" ofType:extension];
        if (resourcePath.length == 0 || ![fileManager fileExistsAtPath:resourcePath])
        {
            continue;
        }

        NSError *error = nil;
        NSData  *data  = [NSData dataWithContentsOfFile:resourcePath options:0 error:&error];
        if (!data || data.length == 0)
        {
            Log("Failed reading script.%@: %@", extension, error);
            continue;
        }

        if (outExtension)
        {
            *outExtension = extension;
        }

        Log("Resolved script.%@ (%lu bytes)", extension, (unsigned long) data.length);
        return data;
    }

    Log("script bundle/js not found in %@", bundlePath);
    return nil;
}

@end
