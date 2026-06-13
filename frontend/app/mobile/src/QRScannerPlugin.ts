import { PermissionState, PluginListenerHandle, registerPlugin } from '@capacitor/core';

export interface PermissionStatus {
    /**
   * Permission state of receiving notifications.
   *
   * @since 1.0.0
   */
    receive: PermissionState;
}

export interface QRScannerPlugin {
    startScanning(): Promise<void>;
    stopScanning(): Promise<void>;

    getTorch(): Promise<{ status: boolean }>;
    toggleTorch(): Promise<{ status: boolean }>;

    /**
     * Check permission 
     */
    checkPermissions(): Promise<PermissionStatus>;

    /**
     * Request permission
     */
    requestPermissions(): Promise<PermissionStatus>;

    addListener(
        eventName: 'scannedQRCode',
        listenerFunc: (result: { value: string }) => void,
    ): Promise<PluginListenerHandle> & PluginListenerHandle;
}


const QRScanner = registerPlugin<QRScannerPlugin>('QRScanner');

export default QRScanner;