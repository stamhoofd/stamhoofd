// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import { expect } from '@playwright/test';
import { WorkerData } from '../helpers/index.js';

/**
 * The web ticket scanner (qr-scanner) decodes QR codes in a Worker created from a blob: URL
 * when the browser has no usable BarcodeDetector (e.g. Safari, Chromium on ARM Macs).
 * Both the production CSP headers and the web-app's meta CSP must allow that worker.
 */
test.describe('Content-Security-Policy allows blob workers @csp', () => {
    test('the web app can start a worker from a blob URL', async ({ page }) => {
        await page.goto(WorkerData.urls.dashboard, { waitUntil: 'load' });

        // Same construction as qr-scanner's createWorker()
        const result = await page.evaluate(async () => {
            const violations: string[] = [];
            document.addEventListener('securitypolicyviolation', (event) => {
                violations.push(event.effectiveDirective);
            });

            const reply = await new Promise<string>((resolve) => {
                try {
                    const worker = new Worker(URL.createObjectURL(new Blob(['onmessage = e => postMessage(e.data * 2)'])));
                    worker.onmessage = e => resolve(`reply ${e.data}`);
                    worker.onerror = () => resolve('worker error');
                    worker.postMessage(21);
                }
                catch (e) {
                    resolve(`blocked: ${(e as Error).message}`);
                }
                setTimeout(() => resolve('timeout'), 5_000);
            });
            return { reply, violations };
        });

        expect(result.violations).toEqual([]);
        expect(result.reply).toBe('reply 42');
    });
});
