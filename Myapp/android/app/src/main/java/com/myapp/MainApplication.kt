package com.myapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.livekit.reactnative.LivekitReactNativePackage
import com.livekit.reactnative.LiveKitReactNative
import com.livekit.reactnative.audio.AudioType

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
          add(LivekitReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    
    // Note: Facebook SDK is auto-initialized via AndroidManifest.xml (AutoInitEnabled=true)
    // No manual initialization needed
    
    // Initialize LiveKit React Native BEFORE loading React Native
    try {
      LiveKitReactNative.setup(this, AudioType.CommunicationAudioType())
    } catch (e: Exception) {
      android.util.Log.e("MainApplication", "Failed to setup LiveKit", e)
    }
    // Load React Native - this initializes the React Native runtime
    loadReactNative(this)
  }
}
