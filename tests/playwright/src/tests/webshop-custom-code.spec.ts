// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { Organization, OrganizationFactory } from '@stamhoofd/models';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { STPackageBundle } from '@stamhoofd/structures';
import { WorkerData } from '../helpers/index.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

/**
 * Webshops can carry admin-defined `customCode`: raw HTML (typically <script> and
 * <style> tags) that WebshopView injects into the document head via
 * injectCustomCode(). Because that code runs with full access to the page, it is
 * only allowed to execute when the shop is served from its own custom domain -
 * never on the shared default webshop domain, where it could affect other shops.
 *
 * The gate lives in isLocationCustomDomain(): it requires an active custom domain
 * AND that the current hostname equals that domain. These tests verify both sides
 * of the gate end-to-end in a real browser:
 *  1. On the shared default domain (no custom domain) the code is NOT injected.
 *  2. On the shop's own custom domain the injected <script> executes and the
 *     injected <style> is actually applied (rendered) to the page.
 */
test.describe('Webshop custom code injection @custom-code', () => {
    // A distinctive colour that no theme sets, so a matching computed colour proves
    // our injected stylesheet is the one that applied.
    const CUSTOM_CODE_COLOR = 'rgb(17, 34, 51)';

    // The injected <script> records that it ran (window flag + a DOM marker), and the
    // injected <style> recolours the shop title. Kept independent so the script and the
    // CSS can be asserted separately.
    const customCode = [
        '<script>',
        '  window.__customCodeExecuted = true;',
        '  var marker = document.createElement("div");',
        '  marker.id = "custom-code-marker";',
        '  document.body.appendChild(marker);',
        '</script>',
        `<style>.webshop-header h1 { color: ${CUSTOM_CODE_COLOR} !important; }</style>`,
    ].join('\n');

    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    async function createWebshopOrganization(prefix: string): Promise<Organization> {
        const organization = await new OrganizationFactory({
            name: `${prefix}${WorkerData.id}`,
            packages: [STPackageBundle.Webshops],
        }).create();

        // Recalculate meta.packages so the public webshop is not rendered as "closed"
        await STPackageService.updateOrganizationPackages(organization.id);

        const refreshed = await Organization.getByID(organization.id);
        if (!refreshed) {
            throw new Error('Organization not found after creation');
        }
        return refreshed;
    }

    /**
     * Read the flags/markers left by the injected code. Returns whether the <script>
     * executed (window flag + marker element) and the computed colour of the title,
     * which reflects whether the injected <style> was applied.
     */
    async function readInjectionState(scope: Page) {
        const scriptExecuted = await scope.evaluate(() => (window as unknown as { __customCodeExecuted?: boolean }).__customCodeExecuted === true);
        const markerCount = await scope.locator('#custom-code-marker').count();
        const titleColor = await scope.locator('.webshop-header h1').first().evaluate(el => getComputedStyle(el).color);
        return { scriptExecuted, markerCount, titleColor };
    }

    test('custom code does NOT run on the default (non-custom) domain', async ({ page }) => {
        const organization = await createWebshopOrganization('CustomCodeDefault');
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Custom code default ${WorkerData.id}`,
            productCount: 1,
            cartEnabled: false,
            customCode,
            // No customDomainPrefix: the shop is only reachable on the shared default domain.
        });

        // Sanity: the shop really has custom code stored, it just may not run here.
        expect(webshop.meta.customCode).toBe(customCode);

        await page.goto(WorkerData.urls.webshopUri(webshop.uri));
        await expect(page.getByTestId('product-box').first()).toBeVisible({ timeout: 15000 });

        const state = await readInjectionState(page);

        // The <script> never executed and its DOM marker was never added.
        expect(state.scriptExecuted).toBe(false);
        expect(state.markerCount).toBe(0);

        // The <style> was not applied: the title keeps its theme colour, not ours.
        expect(state.titleColor).not.toBe(CUSTOM_CODE_COLOR);
    });

    test('custom code runs on the custom domain: script executes and CSS is rendered', async ({ page }) => {
        const organization = await createWebshopOrganization('CustomCodeCustom');
        await TestWebshops.create({
            organization,
            name: `Custom code custom ${WorkerData.id}`,
            productCount: 1,
            cartEnabled: false,
            customCode,
            customDomainPrefix: 'customcode',
        });

        await page.goto(WorkerData.urls.webshopCustomDomain('customcode'));
        await expect(page.getByTestId('product-box').first()).toBeVisible({ timeout: 15000 });

        // The injected DOM marker proves the <script> executed (auto-waits for injection).
        await expect(page.locator('#custom-code-marker')).toHaveCount(1);

        const state = await readInjectionState(page);

        // The <script> executed.
        expect(state.scriptExecuted).toBe(true);

        // The <style> was applied and rendered: the title now uses our injected colour.
        expect(state.titleColor).toBe(CUSTOM_CODE_COLOR);
    });
});
