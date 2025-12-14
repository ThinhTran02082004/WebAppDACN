// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure proper resolution of .js files in node_modules
// This helps resolve modules like @livekit/react-native-webrtc
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;

