THEOS_PACKAGE_SCHEME=rootless
FINALPACKAGE=1
INSTALL_TARGET_PROCESSES = BridgelessApp

ARCHS := arm64 arm64e
TARGET := iphone:clang:latest:15.0

include $(THEOS)/makefiles/common.mk

TWEAK_NAME = Bridgeless
$(TWEAK_NAME)_FILES = $(shell find sources -type f \( -name "*.x*" -o -name "*.m*" -o -name "*.c*" \))
$(TWEAK_NAME)_CFLAGS = -fobjc-arc -std=c++20 -DPACKAGE_VERSION='@"$(THEOS_PACKAGE_BASE_VERSION)"' -Iheaders \
	-Isources/NativeTestModule -I../BridgelessApp/node_modules/react-native/ReactCommon/jsi \
	-I../BridgelessApp/node_modules/react-native/ReactCommon \
	-I../BridgelessApp/node_modules/react-native/ReactCommon/react \
	-I../BridgelessApp/node_modules/react-native/ReactCommon/react/nativemodule/core \
	-I../BridgelessApp/node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios \
	-I../BridgelessApp/node_modules/react-native/React \
	-I../BridgelessApp/node_modules/react-native/Libraries \
	-I../BridgelessApp/node_modules/react-native \
	-I../BridgelessApp/ios/Pods/Headers/Public \
	-I../BridgelessApp/ios/Pods/Headers/Private \
	-I../BridgelessApp/ios/Pods/Headers/Public/React-Core \
	-I../BridgelessApp/ios/Pods/Headers/Public/RCTTypeSafety \
	-I../BridgelessApp/ios/Pods/Headers/Public/RCTRequired \
	-I../BridgelessApp/ios/Pods/Headers/Public/ReactCommon \
	-I../BridgelessApp/ios/Pods/Headers/Public/RCT-Folly \
	-I../BridgelessApp/ios/Pods/Headers/Public/FBLazyVector \
	-I../BridgelessApp/ios/Pods/Headers/Public/React-callinvoker \
	-I../BridgelessApp/ios/Pods/Headers/Public/DoubleConversion \
	-I../BridgelessApp/ios/Pods/Headers/Public/fmt
$(TWEAK_NAME)_LDFLAGS += -undefined dynamic_lookup
$(TWEAK_NAME)_FRAMEWORKS = Foundation UIKit

BUNDLE_NAME = BridgelessResources
$(BUNDLE_NAME)_INSTALL_PATH = "/Library/Application\ Support/"
$(BUNDLE_NAME)_RESOURCE_DIRS = "resources"

HERMESC ?= ../BridgelessApp/node_modules/react-native/sdks/hermesc/osx-bin/hermesc

resources/script.bundle: resources/script.js
	@if [ -x "$(HERMESC)" ]; then \
		"$(HERMESC)" -emit-binary -out "$@" "$<"; \
	else \
		echo "[Bridgeless] Warning: hermesc binary not found at $(HERMESC); skipping bytecode build"; \
		rm -f "$@"; \
	fi

before-all:: resources/script.bundle

include $(THEOS_MAKE_PATH)/tweak.mk
include $(THEOS_MAKE_PATH)/bundle.mk

after-stage::
	find $(THEOS_STAGING_DIR) -name ".DS_Store" -delete
