import type { Page } from '@playwright/test';
import { WorkerData } from './worker/WorkerData.js';

export async function simulateNetworkOffline(page: Page) {
    await page.route(`${WorkerData.urls.api}/**`, async (route) => {
        const url = route.request().url();

        const allowedRoutes = [
            // should still be able to set the frontend-environment for tests
            '/frontend-environment'
        ];

        const shouldAllow = allowedRoutes.some(path => url.includes(path));

        if (shouldAllow) {
            await route.continue();
        } else {
            // simulate network failure
            await route.abort('internetdisconnected');
        }
    });
}
