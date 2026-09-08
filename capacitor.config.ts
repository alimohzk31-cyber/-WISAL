import type { CapacitorConfig } from '@capacitor/cli';

// إعداد Capacitor لتطبيق وصال | WISAL (Android)
const config: CapacitorConfig = {
  appId: 'com.wisal.app',
  appName: 'وصال',
  webDir: 'dist',
  android: {
    // HTTPS فقط — لا يُسمح بمحتوى غير مشفر داخل WebView
    allowMixedContent: false,
  },
  server: {
    // يخدم التطبيق دائماً عبر https:// داخل WebView (وليس http)
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
