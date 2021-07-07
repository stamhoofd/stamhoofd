import { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

// This is the production capacitor configuration
// During syncing capacitor for production, capacitor.config.production.ts will temporarily be renamed to capacitor.config.ts

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
  }
};

export default config;
