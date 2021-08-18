import { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

// This is de development capacitor configuration

const config: CapacitorConfig = {
  appId: 'com.stamhoofd.stamhoofd',
  appName: 'Stamhoofd',
  webDir: 'dist',
  bundledWebRuntime: false,
  loggingBehavior: "none",
  hideLogs: true,
  plugins: {
    Keyboard: {
      resize: KeyboardResize.None,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  },
  // Uncomment to enable live reload
  server: {
    url: "https://dashboard.stamhoofd.dev",
    cleartext: true
  }
};

export default config;
