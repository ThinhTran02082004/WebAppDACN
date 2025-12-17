// Lazy import to avoid loading native module at module level
// import { registerGlobals } from '@livekit/react-native';
// @ts-ignore - event-target-shim has type resolution issues with package.json exports
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

  // For LiveKit Cloud, still add Origin header but use a valid format
  // Some LiveKit Cloud instances may require it for proper WebSocket upgrade
  const isLiveKitCloud = url.includes('.livekit.cloud');
  
  if (
    typeof headers.Origin === 'undefined' &&
    typeof headers.origin === 'undefined'
  ) {
    if (isLiveKitCloud) {
      // For LiveKit Cloud, use the LiveKit domain as origin
      headers.Origin = computeOriginFromUrl(url);
    } else {
      headers.Origin = computeOriginFromUrl(url);
    }
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
    // Lazy import to avoid loading native module at module level
    // This prevents crash on app startup with New Architecture
    const { registerGlobals } = require('@livekit/react-native');
    
    // Use registerGlobals from @livekit/react-native which handles all polyfills
    // including WebSocket, Event, EventTarget, streams, etc.
    // DO NOT patch WebSocket manually - let @livekit/react-native handle it
    registerGlobals({
      autoConfigureAudioSession: true
    });
    globalsRegistered = true;
    console.log('[livekit] LiveKit globals registered successfully');
  } catch (error: any) {
    // If error is about duplicate registration, it's OK
    if (error?.message?.includes('already') || error?.message?.includes('registered')) {
      console.log('[livekit] Globals already registered, skipping');
      globalsRegistered = true;
    } else {
      console.error('[livekit] Failed to register globals', error);
      // Only apply minimal polyfills if registerGlobals fails
      // DO NOT patch WebSocket as it interferes with livekit-client
  try {
    ensureDomEventPolyfills();
    ensureEncodingPolyfills();
    ensureStreamsPolyfill();
        // DO NOT call ensureWebSocketPolyfill() - let livekit-client handle WebSocket
        console.log('[livekit] Minimal fallback polyfills applied (WebSocket not patched)');
      } catch (fallbackError) {
        console.error('[livekit] Fallback polyfills also failed', fallbackError);
      }
    }
  }
};


