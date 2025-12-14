/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import 'react-native-gesture-handler';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { setApiHost, initApiHostFromStorage, clearApiHost, API_BASE } from './src/config';
import { apiService } from './src/services/api';
import Toast from 'react-native-toast-message';
import { configureGoogleSignIn } from './src/config/googleConfig';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  // Load persisted API host (if present) and otherwise set a default recommended host.
  React.useEffect(() => {
    (async () => {
      // ============================================
      // CONFIGURATION FOR iOS PHYSICAL DEVICE
      // ============================================
      // For iOS Physical Device, you need to set your development machine's IP address
      // Current detected IP: 192.168.2.45
      // 
      // If this IP doesn't work, find your IP:
      //   - Windows: Run `ipconfig` in CMD, look for "IPv4 Address" under your WiFi adapter
      //   - Mac: Run `ifconfig | grep "inet "` or check System Preferences > Network
      // ============================================
      
      // Force clear any cached configuration
      await clearApiHost();
      
      // For iOS Physical Device, set your machine's IP address
      // Make sure your iPhone and development machine are on the same WiFi network
      setApiHost('192.168.2.45', '5000'); // Your development machine's IP
      
      // ensure apiService uses the current API_BASE after load/default
      try {
        const baseUrl = typeof API_BASE === 'function' ? API_BASE() : API_BASE as any;
        console.log('[App] Setting API base URL to:', baseUrl);
        apiService.setBaseUrl(baseUrl);
      } catch (error) {
        console.error('[App] Failed to set API base URL:', error);
      }
    })();
  }, []);

  // Configure Google Sign-In once on app start
  React.useEffect(() => {
    try {
      configureGoogleSignIn();
    } catch (e) {
      console.warn('Google Sign-In configuration failed', e);
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppNavigator />
      <Toast />
    </SafeAreaProvider>
  );
}

export default App;

