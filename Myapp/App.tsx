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
      // Force clear any cached configuration to ensure we use the correct IP
      await clearApiHost();
      // Set the correct IP address
      setApiHost('10.0.242.205', '5000');
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
