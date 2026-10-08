import type { Page } from '@playwright/test';

/**
 * Replaces the camera and the QR code detector of the page, so showQRCodeToCamera decides what gets scanned.
 * Call before the page loads.
 */
export async function installFakeCamera(page: Page) {
    await page.addInitScript(() => {
        let shownValue: string | null = null;
        (window as any).showToFakeCamera = (value: string | null) => {
            shownValue = value;
        };

        // qr-scanner prefers the BarcodeDetector of the browser over its own decoder
        (window as any).BarcodeDetector = class {
            static async getSupportedFormats() {
                return ['qr_code'];
            }

            async detect() {
                return shownValue ? [{ rawValue: shownValue }] : [];
            }
        };
        // Otherwise qr-scanner ignores the BarcodeDetector on ARM Macs, because Chromium's is broken there
        Object.defineProperty(navigator, 'userAgentData', { value: undefined });

        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        let isDrawing = false;

        // A canvas stream only produces frames while the canvas is drawn on
        const draw = () => {
            const context = canvas.getContext('2d')!;
            context.fillStyle = 'white';
            context.fillRect(0, 0, canvas.width, canvas.height);
            requestAnimationFrame(draw);
        };

        navigator.mediaDevices.getUserMedia = async () => {
            if (!isDrawing) {
                isDrawing = true;
                draw();
            }
            return canvas.captureStream(10);
        };
    });
}

/**
 * Shows a QR code with this value to the fake camera, or nothing when null.
 */
export async function showQRCodeToCamera(page: Page, value: string | null) {
    await page.evaluate(value => (window as any).showToFakeCamera(value), value);
}
