import { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'app.stamhoofd.stamhoofd',
  appName: 'Stamhoofd',
  webDir: 'dist',
  bundledWebRuntime: false,
  //loggingBehavior: "none",
  plugins: {
    Keyboard: {
      // iOS Only
      resize: KeyboardResize.None,
      //style: "dark"
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  },
  // For development: enable live reload
  server: {
    url: "http://192.168.0.7:8080",
    cleartext: true
  }
};

export default config;
