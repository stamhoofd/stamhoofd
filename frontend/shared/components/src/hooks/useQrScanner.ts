import type { PluginListenerHandle } from '@stamhoofd/frontend-platform/AppManager';
import { AppManager } from '@stamhoofd/frontend-platform/AppManager';
import { sleep } from '@stamhoofd/utility';
import QrScanner from 'qr-scanner';
import type { Ref } from 'vue';
import { ref } from 'vue';

type QrEngine = Awaited<ReturnType<typeof QrScanner.createQrEngine>>;

// Reusing the same worker for every scan randomly breaks on iOS after a certain amount of scans
const QR_ENGINE_MAX_SCANS = 50;

/**
 * The camera of a full screen QR-code scanner, the way TicketScannerView runs it: the native scanner
 * of the app when there is one, otherwise a video element that is read a few times per second.
 *
 * The native scanner draws the camera underneath the web view, so the page and `root` are made
 * transparent while it runs, and `nativeCamera` tells the view to hide its own video.
 */
export function useQrScanner({ video, root, onCode }: {
    video: Ref<HTMLVideoElement | null>;
    root: Ref<HTMLElement | null>;
    onCode: (value: string) => void;
}) {
    const cameras = ref<MediaDeviceInfo[]>([]);
    const cameraIndex = ref(0);
    const hasFlash = ref(false);
    const isFlashOn = ref(false);
    const nativeCamera = ref(false);

    /** No camera, no permission, or a browser that will not hand one over: all the same to the member. */
    const cameraFailed = ref(false);

    let stream: MediaStream | null = null;
    let pollInterval: number | null = null;
    let nativeListener: PluginListenerHandle | null = null;
    let readingQR = false;
    const canvas = document.createElement('canvas');

    let qrEngine: Promise<QrEngine> | null = null;
    let qrEngineScans = 0;

    function getQrEngine(): Promise<QrEngine> {
        if (!qrEngine || qrEngineScans >= QR_ENGINE_MAX_SCANS) {
            disposeQrEngine();
            qrEngine = QrScanner.createQrEngine();
        }
        qrEngineScans += 1;
        return qrEngine;
    }

    function disposeQrEngine() {
        const engine = qrEngine;
        qrEngine = null;
        qrEngineScans = 0;

        engine?.then((e) => {
            if (e instanceof Worker) {
                e.terminate();
            }
        }).catch(console.error);
    }

    /**
     * Square in the center of the visible part of the video, in pixels of the camera frame (the video uses object-fit: cover).
     */
    function getScanRegion(element: HTMLVideoElement): QrScanner.ScanRegion | null {
        const { videoWidth, videoHeight, offsetWidth, offsetHeight } = element;
        if (!videoWidth || !videoHeight || !offsetWidth || !offsetHeight) {
            return null;
        }

        const displayScale = Math.max(offsetWidth / videoWidth, offsetHeight / videoHeight);
        const size = Math.min(offsetWidth * 4 / 5 / displayScale, videoWidth, videoHeight);
        const downScaledSize = Math.min(size, 400);

        return {
            x: Math.round((videoWidth - size) / 2),
            y: Math.round((videoHeight - size) / 2),
            width: Math.round(size),
            height: Math.round(size),
            downScaledWidth: Math.round(downScaledSize),
            downScaledHeight: Math.round(downScaledSize),
        };
    }

    function pollImage() {
        if (video.value === null || readingQR) {
            return;
        }

        const scanRegion = getScanRegion(video.value);
        if (!scanRegion) {
            return;
        }

        readingQR = true;

        QrScanner.scanImage(video.value, {
            scanRegion,
            qrEngine: getQrEngine(),
            canvas,
            returnDetailedScanResult: true,
        })
            .then((result) => {
                readingQR = false;
                if (pollInterval !== null && result.data) {
                    onCode(result.data);
                }
            })
            .catch((e: unknown) => {
                readingQR = false;
                if (e !== QrScanner.NO_QR_CODE_FOUND) {
                    console.error(e);
                    disposeQrEngine();
                }
            });
    }

    function stopPolling() {
        if (pollInterval !== null) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    function stopStream() {
        for (const track of stream?.getTracks() ?? []) {
            track.stop();
        }
        stream = null;
    }

    async function setStream(constraints: MediaStreamConstraints, force = false) {
        if (video.value === null) {
            return;
        }
        stopPolling();

        const element = video.value;
        // iOS only plays inline video with these set before it starts
        element.setAttribute('autoplay', '');
        element.setAttribute('muted', '');
        element.setAttribute('playsinline', '');

        if (!stream || !stream.active || force) {
            stopStream();
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        }
        element.srcObject = stream;
        element.play().catch(console.error);
        pollInterval = window.setInterval(() => pollImage(), 300);

        // The labels and ids of the cameras are only known once we have permission
        cameras.value = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');

        const deviceId = stream.getVideoTracks()[0]?.getSettings().deviceId;
        const index = cameras.value.findIndex(c => c.deviceId === deviceId);
        if (index !== -1) {
            cameraIndex.value = index;
        }
    }

    async function startNative(plugin: NonNullable<typeof AppManager.shared.QRScanner>) {
        await plugin.startScanning();

        // Wait for the transition of the view that opens the scanner
        await sleep(300);

        nativeCamera.value = true;

        // The camera is drawn underneath the web view
        document.body.style.background = 'transparent';
        document.body.style.overflow = 'hidden';
        if (root.value) {
            root.value.style.background = 'transparent';
        }

        nativeListener ??= await plugin.addListener('scannedQRCode', (result) => {
            onCode(result.value);
        });

        try {
            isFlashOn.value = (await plugin.getTorch()).status;
            hasFlash.value = true;
        }
        catch (e) {
            console.error(e);
        }
    }

    async function start() {
        cameraFailed.value = false;

        try {
            const plugin = AppManager.shared.QRScanner;
            if (plugin) {
                await startNative(plugin);
                return;
            }

            if (!navigator.mediaDevices) {
                throw new Error('No camera available');
            }

            await setStream({
                video: cameras.value.length > 0
                    ? { deviceId: cameras.value[cameraIndex.value].deviceId }
                    : { facingMode: 'environment' },
                audio: false,
            });
        }
        catch (error) {
            console.error(error);
            stop();
            cameraFailed.value = true;
        }
    }

    /** Stops reading codes but keeps the camera on, so starting again is instant. */
    function pause() {
        if (AppManager.shared.QRScanner) {
            nativeListener?.remove().catch(console.error);
            nativeListener = null;
            return;
        }
        stopPolling();
    }

    function resume() {
        if (AppManager.shared.QRScanner) {
            start().catch(console.error);
            return;
        }
        if (stream?.active && pollInterval === null) {
            pollInterval = window.setInterval(() => pollImage(), 300);
        }
    }

    function stop() {
        const plugin = AppManager.shared.QRScanner;
        if (plugin) {
            nativeListener?.remove().catch(console.error);
            nativeListener = null;

            if (nativeCamera.value) {
                nativeCamera.value = false;
                document.body.style.background = '';
                document.body.style.overflow = '';
                if (root.value) {
                    root.value.style.background = '';
                }
                plugin.stopScanning().catch(console.error);
            }
            return;
        }

        stopPolling();
        stopStream();
        disposeQrEngine();
    }

    function switchCamera() {
        if (cameras.value.length < 2) {
            return;
        }
        cameraIndex.value = (cameraIndex.value + 1) % cameras.value.length;

        setStream({
            video: { deviceId: cameras.value[cameraIndex.value].deviceId },
            audio: false,
        }, true).catch(console.error);
    }

    function toggleFlash() {
        AppManager.shared.QRScanner?.toggleTorch()
            .then((torch) => {
                isFlashOn.value = torch.status;
            })
            .catch(console.error);
    }

    return { cameras, hasFlash, isFlashOn, nativeCamera, cameraFailed, start, pause, resume, stop, switchCamera, toggleFlash };
}
