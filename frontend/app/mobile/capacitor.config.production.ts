import { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

// This is the production capacitor configuration
// During syncing capacitor for production, capacitor.config.production.ts will temporarily be renamed to capacitor.config.ts

const config: CapacitorConfig = {
    appId: 'com.stamhoofd.stamhoofd',
    appName: 'Stamhoofd',
    webDir: 'dist',
    loggingBehavior: "none",
    plugins: {
        Keyboard: {
            resize: KeyboardResize.None,
        },
        PushNotifications: {
            presentationOptions: ["badge", "sound", "alert"]
        },
        CapacitorUpdater: {
            "autoUpdate": false,
        }
    },
    server: {
        // Add autocomplete passwords
        hostname: 'stamhoofd.app',
        androidScheme: 'https',
    }
};

export default config;
