const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Enable package exports support for libraries like hugeicons
config.resolver.unstable_enablePackageExports = true;
config.resolver.sourceExts.push("mjs");

module.exports = withNativeWind(config, { input: "./global.css" });