// filepath: metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Enable package exports support for libraries like hugeicons
config.resolver.unstable_enablePackageExports = true;
// Add cjs to the extensions list
config.resolver.sourceExts.push("mjs", "cjs");

// Fix for @iabtcf/core (used by react-native-google-mobile-ads) failing to resolve .mjs imports
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@iabtcf/core")) {
    // Force Metro to use the CommonJS build instead of the broken ESM build for this package
    return context.resolveRequest(
      { ...context, unstable_conditionNames: ["require", "react-native"] },
      moduleName,
      platform
    );
  }
  // For all other modules, use the default resolver
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });