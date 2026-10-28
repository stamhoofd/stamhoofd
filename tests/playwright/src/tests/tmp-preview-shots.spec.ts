// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import type { User } from '@stamhoofd/models';
import { Order, Organization, OrganizationFactory, UserFactory, Webshop } from '@stamhoofd/models';
import { RichText, PaymentMethod, Permissions, Product, ProductDateRange, ProductPrice, ProductType, STPackageBundle, Token as TokenStruct, Version, WebshopOrderMode, WebshopTicketType, WebshopType } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { WebshopOrderFlow } from '../flows/WebshopOrderFlow.js';
import { DashboardPage, DashboardTab, WorkerData } from '../helpers/index.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

let organizationCounter = 0;

async function createOrganization({ modernWebshop = true }: { modernWebshop?: boolean } = {}) {
    organizationCounter += 1;
    const organization = await new OrganizationFactory({
        name: `OrderModes${WorkerData.id}-${Date.now()}-${organizationCounter}`,
        packages: [STPackageBundle.Webshops],
    }).create();

    // Recalculate meta.packages so the public webshop is not rendered as "closed"
    await STPackageService.updateOrganizationPackages(organization.id);
    const refreshed = (await Organization.getByID(organization.id))!;
    refreshed.privateMeta.featureFlags = modernWebshop ? ['modern-webshop'] : [];
    await refreshed.save();
    return refreshed;
}

async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await SessionService.createSession(user);
    const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
    const organizationId = user.organizationId;

    await page.addInitScript(({ organizationId, tokenString }) => {
        window.localStorage.setItem('token-' + organizationId, tokenString);
    }, { organizationId, tokenString });
}

async function openWebshopsAsAdmin(page: Page, organization: Organization) {
    const admin = await new UserFactory({
        email: `admin-${WorkerData.id}-${Date.now()}@test.be`,
        organization,
        permissions: Permissions.create({ level: PermissionLevel.Full }),
    }).create();
    await loginAs({ page, user: admin });

    const dashboard = new DashboardPage(page);
    await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
    await dashboard.openTab(DashboardTab.Webshops);
}

async function openRecordSettings(page: Page, organization: Organization, webshop: Webshop) {
    await openWebshopsAsAdmin(page, organization);
    await page.getByTestId('webshop-menu-item').filter({ hasText: webshop.meta.name }).click();
    await page.getByRole('heading', { name: 'Contactgegevens' }).click();
}

async function openProductOffer(page: Page, organization: Organization, webshop: Webshop) {
    await openWebshopsAsAdmin(page, organization);
    await page.getByTestId('webshop-menu-item').filter({ hasText: webshop.meta.name }).click();
    // Named differently for a webshop with only tickets
    await page.getByRole('heading', { name: /^(Productaanbod|Aanbod tickets en vouchers)$/ }).click();
}


test.describe('tmp preview screenshots @tmp-preview-shots', () => {
    test.skip('screenshots', async ({ page }) => {
        await page.setViewportSize({ width: 1215, height: 1025 });
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({ organization, name: `Preview shot ${WorkerData.id}`, productCount: 2, cartEnabled: true });
        await openProductOffer(page, organization, webshop);
        const pane = page.locator('.webshop-preview-card');
        await expect(page.frameLocator('.webshop-preview-card iframe').getByTestId('product-box')).toHaveCount(2, { timeout: 20000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: '/private/tmp/claude-501/-Users-simon-Documents-Projects-stamhoofd/f526330c-f5ad-4875-b3bd-0cdd7193a164/scratchpad/pane-smartphone.png' });
        (await import('fs')).writeFileSync('/private/tmp/claude-501/-Users-simon-Documents-Projects-stamhoofd/f526330c-f5ad-4875-b3bd-0cdd7193a164/scratchpad/measure.json', JSON.stringify(await page.evaluate(() => {
            const out: any[] = [];
            const col = document.querySelector('.preview-panel-column')!;
            out.push(['column', col.clientHeight, col.scrollHeight, getComputedStyle(col).paddingTop, getComputedStyle(col).paddingBottom]);
            let el: Element | null = document.querySelector('.webshop-preview-card');
            while (el && el !== col) {
                const b = el.getBoundingClientRect();
                const cs = getComputedStyle(el);
                out.push([el.className, b.top, b.bottom, cs.marginTop, cs.marginBottom, cs.paddingBottom]);
                el = el.parentElement;
            }
            const cb = col.getBoundingClientRect();
            out.push(['colrect', cb.top, cb.bottom, window.innerHeight]);
            return out;
        }), null, 1));
        await pane.locator('.devices .item:has(.icon.laptop)').click();
        await page.mouse.move(0, 0);
        await page.waitForTimeout(800);
        await page.screenshot({ path: '/private/tmp/claude-501/-Users-simon-Documents-Projects-stamhoofd/f526330c-f5ad-4875-b3bd-0cdd7193a164/scratchpad/pane-laptop.png' });
        await page.getByTestId('webshop-full-preview-button').click();
        const frame = page.frameLocator('.webshop-full-preview-view iframe');
        await expect(frame.getByTestId('product-box')).toHaveCount(2, { timeout: 20000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: '/private/tmp/claude-501/-Users-simon-Documents-Projects-stamhoofd/f526330c-f5ad-4875-b3bd-0cdd7193a164/scratchpad/full-laptop.png' });
        await page.locator('.webshop-full-preview-view .devices .item:has(.icon.smartphone)').click();
        await page.mouse.move(0, 0);
        await page.waitForTimeout(800);
        await page.screenshot({ path: '/private/tmp/claude-501/-Users-simon-Documents-Projects-stamhoofd/f526330c-f5ad-4875-b3bd-0cdd7193a164/scratchpad/full-smartphone.png' });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(800);
        await page.screenshot({ path: '/private/tmp/claude-501/-Users-simon-Documents-Projects-stamhoofd/f526330c-f5ad-4875-b3bd-0cdd7193a164/scratchpad/full-mobile.png' });
        await page.setViewportSize({ width: 1400, height: 900 });
        await page.locator('.webshop-full-preview-view').getByTestId('close-button').click();
        await expect(page.locator('.webshop-full-preview-view')).toHaveCount(0);
    });

    test.skip('page settings', async ({ page }) => {
        const logs: string[] = [];
        page.on('console', m => logs.push(m.type() + ' ' + m.text()));
        await page.setViewportSize({ width: 1400, height: 900 });
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({ organization, name: `Preview page ${WorkerData.id}`, productCount: 2, cartEnabled: true });
        await openWebshopsAsAdmin(page, organization);
        await page.getByTestId('webshop-menu-item').filter({ hasText: webshop.meta.name }).click();
        await page.getByRole('heading', { name: "Omslagfoto, beschrijving, kleur, en externe links" }).click();
        await expect(page.frameLocator('.webshop-preview-card iframe').getByTestId('product-box')).toHaveCount(2, { timeout: 20000 });
        await page.locator('.webshop-view-page input.input').first().fill('Nieuwe titel');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: '/private/tmp/claude-501/-Users-simon-Documents-Projects-stamhoofd/f526330c-f5ad-4875-b3bd-0cdd7193a164/scratchpad/page-pane.png' });
        const preview = page.frameLocator('.webshop-preview-card iframe');
        await expect(preview.getByText('Gemaakt met')).toBeVisible();
        await page.locator('.webshop-view-page select').first().selectOption('en');
        logs.push('--- selected ' + await page.locator('.webshop-view-page select').first().inputValue());
        await page.waitForTimeout(3000);
        (await import('fs')).writeFileSync('/private/tmp/claude-501/-Users-simon-Documents-Projects-stamhoofd/f526330c-f5ad-4875-b3bd-0cdd7193a164/scratchpad/logs.txt', logs.join('\n'));
        await expect(preview.getByText('Gemaakt met')).toHaveCount(0, { timeout: 10000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: '/private/tmp/claude-501/-Users-simon-Documents-Projects-stamhoofd/f526330c-f5ad-4875-b3bd-0cdd7193a164/scratchpad/page-pane-en.png' });
    });

    test('description whitespace', async ({ page }) => {
        await page.setViewportSize({ width: 1400, height: 900 });
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({ organization, name: `Preview desc ${WorkerData.id}`, productCount: 2, cartEnabled: true });
        webshop.meta.description = RichText.create({ html: '<p>Een beschrijving</p>', text: 'Een beschrijving' });
        await webshop.save();
        await openWebshopsAsAdmin(page, organization);
        await page.getByTestId('webshop-menu-item').filter({ hasText: webshop.meta.name }).click();
        await page.getByRole('heading', { name: 'Omslagfoto, beschrijving, kleur, en externe links' }).click();
        const preview = page.frameLocator('.webshop-preview-card iframe');
        await expect(preview.getByText('Een beschrijving')).toBeVisible({ timeout: 20000 });
        const results: any[] = [];
        const measure = async (label: string) => {
            await page.waitForTimeout(800);
            results.push([label, await preview.locator('body').evaluate(() => {
                const h1 = document.querySelector('.modern-webshop-view .content > h1')!.getBoundingClientRect();
                const content = document.querySelector('.modern-webshop-view .content')!;
                const next = content.nextElementSibling!;
                const firstProduct = document.querySelector('.modern-webshop-view [data-testid="product-box"]')?.getBoundingClientRect();
                return {
                    contentChildren: Array.from(content.children).map(c => c.tagName + '.' + c.className),
                    contentHtml: content.innerHTML.slice(0, 300),
                    next: next.className, nextPaddingTop: getComputedStyle(next).paddingTop,
                    gap: firstProduct ? firstProduct.top - h1.bottom : null,
                };
            })]);
            await page.screenshot({ path: '/private/tmp/claude-501/-Users-simon-Documents-Projects-stamhoofd/f526330c-f5ad-4875-b3bd-0cdd7193a164/scratchpad/desc-' + label + '.png' });
        };
        await measure('1-initial');
        const editor = page.locator('.webshop-view-page .ProseMirror, .webshop-view-page [contenteditable="true"]').first();
        await editor.click();
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.press('Backspace');
        await measure('2-cleared');
        await page.locator('.webshop-view-page label, .webshop-view-page .st-list-item').filter({ hasText: 'Naast elkaar' }).first().click();
        await measure('3-split');
        await page.locator('.webshop-view-page label, .webshop-view-page .st-list-item').filter({ hasText: 'Onder elkaar' }).first().click();
        await measure('4-back');
        (await import('fs')).writeFileSync('/private/tmp/claude-501/-Users-simon-Documents-Projects-stamhoofd/f526330c-f5ad-4875-b3bd-0cdd7193a164/scratchpad/desc.json', JSON.stringify(results, null, 1));
    });
});
