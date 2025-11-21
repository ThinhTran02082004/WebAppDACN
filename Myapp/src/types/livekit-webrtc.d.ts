declare module '@livekit/react-native-webrtc/lib/commonjs' {
  export * from '@livekit/react-native-webrtc';
}

declare module 'text-encoding' {
  export const TextEncoder: typeof globalThis.TextEncoder;
  export const TextDecoder: typeof globalThis.TextDecoder;
}

