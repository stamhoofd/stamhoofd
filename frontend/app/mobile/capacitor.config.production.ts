import { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

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
