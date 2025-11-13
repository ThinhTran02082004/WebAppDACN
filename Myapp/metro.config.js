// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Nếu cần tùy chỉnh thêm thì chỉnh trên object `config`.
// Ví dụ (không bắt buộc):
// config.resolver.platforms.push('web');

module.exports = config;
