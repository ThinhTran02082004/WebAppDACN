import { registerGlobals } from '@livekit/react-native-webrtc/lib/commonjs';
import { EventTarget as ShimEventTarget } from 'event-target-shim';
import { TextDecoder as PolyfillTextDecoder, TextEncoder as PolyfillTextEncoder } from 'text-encoding';
import {
  ReadableStream as PolyfillReadableStream,
  WritableStream as PolyfillWritableStream
} from 'web-streams-polyfill';

let globalsRegistered = false;
let websocketPatched = false;

type BasicEventInit = {
  bubbles?: boolean;
  cancelable?: boolean;
  target?: any;
  currentTarget?: any;
};

const ensureDomEventPolyfills = () => {
  const globalObj = globalThis as any;

  if (typeof globalObj.Event === 'undefined') {
    class BasicEvent {
      type: string;
      bubbles: boolean;
      cancelable: boolean;
      defaultPrevented: boolean;
      target: any;
      currentTarget: any;
      timeStamp: number;

      constructor(type: string, eventInit?: BasicEventInit) {
        this.type = type;
        this.bubbles = !!eventInit?.bubbles;
        this.cancelable = !!eventInit?.cancelable;
        this.defaultPrevented = false;
        this.target = eventInit?.target ?? null;
        this.currentTarget = eventInit?.currentTarget ?? null;
        this.timeStamp = Date.now();
      }

      preventDefault() {
        if (this.cancelable) {
          this.defaultPrevented = true;
        }
      }

      stopPropagation() {
        // no-op shim
      }

      stopImmediatePropagation() {
        // no-op shim
      }
    }

    globalObj.Event = BasicEvent;
  }

  if (typeof globalObj.EventTarget === 'undefined' && typeof ShimEventTarget !== 'undefined') {
    globalObj.EventTarget = ShimEventTarget;                                                                        
  }
};

const ensureEncodingPolyfills = () => {
  const globalObj = globalThis as any;

  if (typeof globalObj.TextEncoder === 'undefined') {
    globalObj.TextEncoder = PolyfillTextEncoder;
  }

  if (typeof globalObj.TextDecoder === 'undefined') {
    globalObj.TextDecoder = PolyfillTextDecoder;
  }
};

const ensureStreamsPolyfill = () => {
  const globalObj = globalThis as any;

  if (typeof globalObj.ReadableStream === 'undefined') {
    globalObj.ReadableStream = PolyfillReadableStream as any;
  }

  if (typeof globalObj.WritableStream === 'undefined') {
    globalObj.WritableStream = PolyfillWritableStream as any;
  }
};

const computeOriginFromUrl = (url?: string) => {
  if (!url) {
    return 'https://react-native.app';
  }

  try {
    const parsed = new URL(url) as URL & { protocol: string; host: string };
    const protocol = parsed.protocol === 'ws:' ? 'http:' : 'https:';
    // Remove /rtc path from host for Origin header
    const host = parsed.host;
    return `${protocol}//${host}`;
  } catch {
    return 'https://react-native.app';
  }
};

const ensureOriginHeader = (url: string, options?: Record<string, any>) => {
  const headers = options?.headers || {};

  // For LiveKit Cloud, don't add Origin header as it may cause issues
  // LiveKit Cloud handles WebSocket connections differently
  const isLiveKitCloud = url.includes('.livekit.cloud');
  
  if (
    !isLiveKitCloud &&
    typeof headers.Origin === 'undefined' &&
    typeof headers.origin === 'undefined'
  ) {
    headers.Origin = computeOriginFromUrl(url);
  }

  return {
    ...options,
    headers
  };
};

const patchWebSocketOriginHeader = (globalObj: any) => {
  if (websocketPatched) {
    return;
  }

  const NativeWebSocket = globalObj.WebSocket;
  if (typeof NativeWebSocket !== 'function') {
    return;
  }

  const PatchedWebSocket = function (
    url: string,
    protocols?: string | string[] | undefined,
    options?: Record<string, any>
  ) {
    let normalizedProtocols: string | string[] | undefined = protocols;
    let normalizedOptions: Record<string, any> | undefined = options;

    // React Native allows passing options as the second argument
    if (
      normalizedProtocols &&
      typeof normalizedProtocols === 'object' &&
      !Array.isArray(normalizedProtocols)
    ) {
      normalizedOptions = normalizedProtocols as Record<string, any>;
      normalizedProtocols = undefined;
    }

    // For LiveKit WebSocket connections in React Native, pass through options as-is
    // Don't modify headers unless explicitly needed, as this can interfere with
    // the WebSocket upgrade handshake that LiveKit SDK handles
    let finalOptions = normalizedOptions || {};
    finalOptions = ensureOriginHeader(url, finalOptions);

    try {
      // Only pass options if they exist and are non-empty
      // React Native WebSocket handles options differently than browser WebSocket
      if (typeof normalizedProtocols === 'undefined') {
        if (finalOptions && Object.keys(finalOptions).length > 0) {
          return new NativeWebSocket(url, undefined, finalOptions);
        }
        return new NativeWebSocket(url);
      }
      if (finalOptions && Object.keys(finalOptions).length > 0) {
        return new NativeWebSocket(url, normalizedProtocols, finalOptions);
      }
      return new NativeWebSocket(url, normalizedProtocols);
    } catch (error) {
      console.warn('[livekit] Patched WebSocket failed to construct, falling back', error);
      if (typeof normalizedProtocols === 'undefined') {
        return new NativeWebSocket(url);
      }
      return new NativeWebSocket(url, normalizedProtocols);
    }
  };

  // Preserve static properties (e.g., CONNECTING, OPEN, etc.)
  Object.assign(PatchedWebSocket, NativeWebSocket);
  PatchedWebSocket.prototype = NativeWebSocket.prototype;

  globalObj.WebSocket = PatchedWebSocket;
  websocketPatched = true;
  console.log('[livekit] WebSocket origin header patched');
};

const ensureWebSocketPolyfill = () => {
  const globalObj = globalThis as any;

  if (typeof globalObj.WebSocket === 'undefined') {
    try {
      if (typeof WebSocket !== 'undefined') {
        globalObj.WebSocket = WebSocket;
        console.log('[livekit] WebSocket polyfill set successfully');
      } else {
        console.warn('[livekit] WebSocket is not available in this environment');
      }
    } catch (e) {
      console.warn('[livekit] WebSocket not available', e);
    }
  }

  if (typeof globalObj.WebSocket !== 'undefined') {
    patchWebSocketOriginHeader(globalObj);
  }
};

export const ensureLivekitGlobals = () => {
  if (globalsRegistered) {
    return;
  }

  try {
    ensureDomEventPolyfills();
    ensureEncodingPolyfills();
    ensureStreamsPolyfill();
    ensureWebSocketPolyfill();
    registerGlobals();
    globalsRegistered = true;
    console.log('[livekit] WebRTC globals registered successfully');
  } catch (error) {
    console.error('[livekit] Failed to register WebRTC globals', error);
  }
};


