THEOS_PACKAGE_SCHEME=rootless
FINALPACKAGE=1
INSTALL_TARGET_PROCESSES = BridgelessApp

ARCHS := arm64 arm64e
TARGET := iphone:clang:latest:15.0

include $(THEOS)/makefiles/common.mk

TWEAK_NAME = Bridgeless
$(TWEAK_NAME)_FILES = $(shell find sources -name "*.x*" -o -name "*.m*")
$(TWEAK_NAME)_CFLAGS = -fobjc-arc -std=c++17 -DPACKAGE_VERSION='@"$(THEOS_PACKAGE_BASE_VERSION)"' -Iheaders \
	-I../BridgelessApp/node_modules/react-native/ReactCommon/jsi
$(TWEAK_NAME)_LDFLAGS += -undefined dynamic_lookup
$(TWEAK_NAME)_FRAMEWORKS = Foundation

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
