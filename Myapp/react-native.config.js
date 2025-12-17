module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: [
    './src/assets/', 
    './backgrounds/',
  ],
  dependencies: {
    'livekit-react-native': {
      platforms: {
        android: null, // disable Android platform, as we use @livekit/react-native instead
      },
    },
    'react-native-webrtc': {
      platforms: {
        android: null, // disable Android platform, as we use @livekit/react-native-webrtc instead
      },
    },
    '@react-native-vector-icons/ionicons': {
      platforms: {
        android: null, // Disable native linking completely - only fonts are needed, already copied to assets
      },
    },
  },
};
