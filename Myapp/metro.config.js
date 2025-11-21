const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

const sourceExts = defaultConfig.resolver?.sourceExts || [];

const config = {
  resolver: {
    platforms: ['ios', 'android', 'native', 'web'],
    sourceExts: Array.from(new Set([...sourceExts, 'ts', 'tsx']))
  },
};

module.exports = mergeConfig(defaultConfig, config);
