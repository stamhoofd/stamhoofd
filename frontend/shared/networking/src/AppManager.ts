import { UrlHelper } from '@simonbackx/vue-app-navigation';
import { SessionDeviceType, type SessionMetaData, SessionOS } from '@stamhoofd/structures';
import type { SessionContext } from './SessionContext';

// TODO: remove duplicate type definitions, but need to check if capacitor won't get loaded on the web...
type PermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';
export interface PermissionStatus {
    receive: PermissionState;
}

export interface PluginListenerHandle {
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
    ): Promise<PluginListenerHandle>;
};

export type UpdateOptions = {
    customText?: string;
    visibleCheck?: 'spinner' | 'text';
    visibleDownload?: boolean;
    installAutomatically?: boolean;
    checkTimeout?: number;
    /**
     * Download and install latest version again
     */
    force?: boolean;
    channel?: string;
};

export class AppManager {
    static shared = new AppManager();

    platform: 'android' | 'ios' | 'web' = 'web';

    /// If needed: in the app we need to override XMLHttpRequest with native http requests to prevent CORS in some API's
    overrideXMLHttpRequest?: any;

    nativeVersion?: string;
    nativeBuild?: string;
    private nativeDeviceInfo: Promise<{ name?: string; model: string; operatingSystem: string; osVersion: string }> | null = null;

    get isNative(): boolean {
        return this.platform !== 'web';
    }

    get isOnDashboardDomain() {
        return this.isNative || UrlHelper.shared.url.host === STAMHOOFD.domains.dashboard;
    }

    setVersion({ version, build }: { version: string; build: string }) {
        this.nativeVersion = version;
        this.nativeBuild = build;
    }

    setNativeDeviceInfo(info: Promise<{ name?: string; model: string; operatingSystem: string; osVersion: string }>) {
        this.nativeDeviceInfo = info;
    }

    async getSessionMetaData(): Promise<SessionMetaData> {
        const userAgent = navigator.userAgent || '';
        const native = this.nativeDeviceInfo ? await this.nativeDeviceInfo.catch(() => null) : null;
        const isIPad = native?.model.toLowerCase().includes('ipad') || (/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1);
        const isTablet = isIPad || (/Android/.test(userAgent) && !/Mobile/.test(userAgent));
        const isPhone = !isTablet && (this.platform === 'ios' || this.platform === 'android' || /iPhone|iPod|Android.+Mobile/.test(userAgent));

        return {
            deviceType: isTablet ? SessionDeviceType.Tablet : (isPhone ? SessionDeviceType.Phone : SessionDeviceType.Desktop),
            deviceName: native?.name || native?.model || null,
            osName: native ? this.getNativeSessionOS(native.operatingSystem, isIPad) : this.getBrowserSessionOS(userAgent, isIPad),
            osVersion: native?.osVersion || this.getBrowserOSVersion(userAgent),
            appVersion: STAMHOOFD.VERSION?.toString() ?? null,
            nativeAppVersion: this.nativeVersion ?? null,
            browserName: this.isNative ? null : this.getBrowserName(userAgent),
        };
    }

    private getNativeSessionOS(operatingSystem: string, isIPad: boolean): SessionOS | null {
        if (isIPad) return SessionOS.iPadOS;
        if (operatingSystem === 'ios') return SessionOS.iOS;
        if (operatingSystem === 'android') return SessionOS.Android;
        return null;
    }

    private getBrowserSessionOS(userAgent: string, isIPad: boolean): SessionOS | null {
        if (isIPad) return SessionOS.iPadOS;
        if (/iPhone|iPod/.test(userAgent)) return SessionOS.iOS;
        if (/Android/.test(userAgent)) return SessionOS.Android;
        if (/CrOS/.test(userAgent)) return SessionOS.ChromeOS;
        if (/Windows/.test(userAgent)) return SessionOS.Windows;
        if (/Mac OS X/.test(userAgent)) return SessionOS.MacOS;
        if (/Linux/.test(userAgent)) return SessionOS.Linux;
        return null;
    }

    private getBrowserOSVersion(userAgent: string): string | null {
        const match = userAgent.match(/(?:CPU (?:iPhone )?OS|Android|Windows NT|Mac OS X|CrOS \S+) ([0-9._]+)/);
        return match?.[1]?.replaceAll('_', '.') ?? null;
    }

    private getBrowserName(userAgent: string): string {
        if (/SamsungBrowser\//.test(userAgent)) return 'SamsungBrowser';
        if (/Ecosia\//.test(userAgent)) return 'Ecosia';
        if (/DuckDuckGo|DdgA|DdgI/.test(userAgent)) return 'DuckDuckGo';
        if (/Edg(?:e|A|iOS)?\//.test(userAgent)) return 'Edge';
        if (/OPR\//.test(userAgent)) return 'Opera';
        if (/Firefox\/|FxiOS\//.test(userAgent)) return 'Firefox';
        if (/Chrome\/|CriOS\//.test(userAgent)) return 'Chrome';
        if (/Safari\//.test(userAgent)) return 'Safari';
        return 'Other';
    }

    hapticWarning = () => {
        if (window.navigator.vibrate) {
            window.navigator.vibrate([100, 100, 100]);
        }
    };

    hapticError = () => {
        if (window.navigator.vibrate) {
            window.navigator.vibrate([100, 100, 100]);
        }
    };

    hapticTap = () => {
        if (window.navigator.vibrate) {
            window.navigator.vibrate(50);
        }
    };

    hapticSuccess = () => {
        if (window.navigator.vibrate) {
            window.navigator.vibrate(100);
        }
    };

    /**
     * Mark a place in the app where an app review is appropriate.
     */
    markReviewMoment = (_: SessionContext) => {
        // No default implementation
    };

    checkUpdates: (options?: UpdateOptions) => Promise<void> = async () => {
        // No default implementation
    };

    downloadFile: (data: Blob | File | URL, filename: string) => Promise<void>;

    // Optional: if the current platform ahs a native scanner (see QRScannerPlugin in mobile frontend), this pluging will get instered here
    QRScanner?: QRScannerPlugin;

    getOS(): 'android' | 'iOS' | 'web' | 'macOS' | 'windows' | 'unknown' {
        if (this.platform === 'ios') {
            return 'iOS';
        }

        if (this.platform === 'android') {
            return 'android';
        }

        const userAgent = navigator.userAgent || navigator.vendor;

        if (/android/i.test(userAgent)) {
            return 'android';
        }

        if (/Mac OS X 10_14|Mac OS X 10_13|Mac OS X 10_12|Mac OS X 10_11|Mac OS X 10_10|Mac OS X 10_9/.test(userAgent)) {
            // Different sms protocol
            return 'macOS';
        }

        // iOS detection from: http://stackoverflow.com/a/9039885/177710
        if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
            return 'iOS';
        }

        // iPad on iOS 13 detection
        if (navigator.userAgent.includes('Mac') && 'ontouchend' in document) {
            return 'iOS';
        }

        if (navigator.platform.toUpperCase().indexOf('MAC') >= 0) {
            return 'macOS';
        }

        if (navigator.platform.toUpperCase().indexOf('WIN') >= 0) {
            return 'windows';
        }

        if (navigator.platform.toUpperCase().indexOf('IPHONE') >= 0) {
            return 'iOS';
        }

        if (navigator.platform.toUpperCase().indexOf('ANDROID') >= 0) {
            return 'android';
        }

        return 'unknown';
    }

    constructor() {
        this.downloadFile = async (data: Blob | File | URL, filename: string) => {
            const saveAs = (await import('file-saver')).default.saveAs;
            saveAs(data instanceof URL ? data.href : data, filename);
        };
    }
}
