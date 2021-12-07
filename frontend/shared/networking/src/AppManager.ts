// todo: remove duplicate type definitions, but need to check if capacitor won't get loaded on the web...
type PermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';
export interface PermissionStatus {
    receive: PermissionState;
}

interface PluginListenerHandle {
    remove: () => Promise<void>;
}

type QRScannerPlugin = {
    startScanning(): Promise<void>;
    getTorch(): Promise<{ status: boolean }>;
    toggleTorch(): Promise<{ status: boolean }>;
    stopScanning(): Promise<void>;
    checkPermissions(): Promise<PermissionStatus>;
    requestPermissions(): Promise<PermissionStatus>;
    addListener(
        eventName: 'scannedQRCode',
        listenerFunc: (result: { value: string }) => void,
    ): Promise<PluginListenerHandle>
}

export class AppManager {
    static shared = new AppManager()

    platform: "android" | "ios" | "web" = "web"

    /// If needed: in the app we need to override XMLHttpRequest with native http requests to prevent CORS in some API's
    overrideXMLHttpRequest?: any

    get isNative(): boolean {
        return this.platform !== "web"
    }

    hapticWarning = () => {
        if (window.navigator.vibrate) {
            window.navigator.vibrate([100, 100, 100]);
        }
    }

    hapticError = () => {
        if (window.navigator.vibrate) {
            window.navigator.vibrate([100, 100, 100]);
        }
    }

    hapticTap = () => {
        if (window.navigator.vibrate) {
            window.navigator.vibrate(50);
        }
    }

    hapticSuccess = () => {
        if (window.navigator.vibrate) {
            window.navigator.vibrate(100);
        }
    }

    // Optional: if the current platform ahs a native scanner (see QRScannerPlugin in mobile frontend), this pluging will get instered here
    QRScanner?: QRScannerPlugin
}