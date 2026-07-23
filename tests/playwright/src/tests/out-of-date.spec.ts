// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import { expect } from '@playwright/test';
import { WorkerData } from '../helpers/index.js';

/**
 * Each app runs a tiny inline browser-support check in its index.html: if
 * Array.prototype.flatMap is missing (the feature that maps to the oldest
 * browsers we still support), it redirects to /out-of-date.html?back=<visited path>.
 *
 * out-of-date.html then restores the original url via history.replaceState, so the
 * address bar keeps showing the page the visitor tried to open instead of
 * /out-of-date.html.
 *
 * These tests simulate such an old browser (by removing flatMap before any page
 * script runs) and verify for both apps that use out-of-date.html:
 *  - the out-of-date message is shown
 *  - the visited url is preserved (out-of-date.html is not visible in the address bar)
 */
test.describe('Out of date browser @out-of-date', () => {
    test.beforeEach(async ({ page }) => {
        // Simulate a browser without flatMap. addInitScript runs before any page
        // script on every navigation, so the inline check sees flatMap missing.
        await page.addInitScript(() => {
            delete (Array.prototype as { flatMap?: unknown }).flatMap;
        });
    });

    const apps = [
        { name: 'web app', domain: () => WorkerData.urls.dashboard, path: '/leden/start?foo=bar' },
        { name: 'webshop', domain: () => WorkerData.urls.webshop, path: '/mijn-webshop?ref=email' },
    ];

    for (const app of apps) {
        test(`redirects to the out-of-date page on the ${app.name} while keeping the visited url`, async ({ page }) => {
            const visitedUrl = app.domain() + app.path;

            // The inline browser check redirects to /out-of-date.html?back=<visited path>.
            // Wait only for the initial response to commit, so we don't race the redirect.
            await page.goto(visitedUrl, { waitUntil: 'commit' });

            // The out-of-date message is displayed.
            await expect(page.getByRole('heading', { name: 'Jouw browser of besturingssysteem is te oud.' })).toBeVisible();
            await expect(page).toHaveTitle('Jouw browser of besturingssysteem is te oud');

            // The original url is restored via history.replaceState: the address bar keeps
            // the visited url and never shows out-of-date.html.
            await expect(page).toHaveURL(visitedUrl);
            expect(page.url()).not.toContain('out-of-date.html');
        });
    }
});
