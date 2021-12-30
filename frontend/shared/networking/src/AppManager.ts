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

    downloadFile: ((data: any, filename: string) => Promise<void>) | null = null

    // Optional: if the current platform ahs a native scanner (see QRScannerPlugin in mobile frontend), this pluging will get instered here
    QRScanner?: QRScannerPlugin

    getOS(): "android" | "iOS" | "web" | "macOS" | "windows" | "unknown"  {
        if (this.platform === "ios") {
            return "iOS"
        }

        if (this.platform === "android") {
            return "android"
        }

        const userAgent = navigator.userAgent || navigator.vendor;

        if (/android/i.test(userAgent)) {
            return "android";
        }

        if (/Mac OS X 10_14|Mac OS X 10_13|Mac OS X 10_12|Mac OS X 10_11|Mac OS X 10_10|Mac OS X 10_9/.test(userAgent)) {
            // Different sms protocol
            return "macOS";
        }

        // iOS detection from: http://stackoverflow.com/a/9039885/177710
        if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
            return "iOS";
        }

        // iPad on iOS 13 detection
        if (navigator.userAgent.includes("Mac") && "ontouchend" in document) {
            return "iOS";
        }

        if (navigator.platform.toUpperCase().indexOf('MAC')>=0 ) {
            return "macOS";
        }

        if (navigator.platform.toUpperCase().indexOf('WIN')>=0 ) {
            return "windows";
        }

        if (navigator.platform.toUpperCase().indexOf('IPHONE')>=0 ) {
            return "iOS";
        }

        if (navigator.platform.toUpperCase().indexOf('ANDROID')>=0 ) {
            return "android";
        }

        return "unknown"
    
    }
    
}