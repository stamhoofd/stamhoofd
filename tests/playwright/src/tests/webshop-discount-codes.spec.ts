// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import type { User, Webshop } from '@stamhoofd/models';
import { Organization, OrganizationFactory, UserFactory, WebshopDiscountCode } from '@stamhoofd/models';
import { Discount, PermissionLevel, Permissions, STPackageBundle, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { DashboardPage, DashboardTab, TableHelper, WorkerData } from '../helpers/index.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

async function createWebshopOrganization(prefix: string): Promise<Organization> {
    const organization = await new OrganizationFactory({
        name: `${prefix}${WorkerData.id}`,
        packages: [STPackageBundle.Webshops],
    }).create();

    await STPackageService.updateOrganizationPackages(organization.id);

    const refreshed = await Organization.getByID(organization.id);
    if (!refreshed) {
        throw new Error('Organization not found after creation');
    }
    return refreshed;
}

async function createAdmin(organization: Organization): Promise<User> {
    const email = `admin-${WorkerData.id}-${Date.now()}@test.be`;
    return await new UserFactory({ email, organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
}

async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await SessionService.createSession(user);
    const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
    const organizationId = user.organizationId;

    await page.addInitScript(({ organizationId, tokenString }) => {
        window.localStorage.setItem('token-' + organizationId, tokenString);
    }, { organizationId, tokenString });
}

async function createDiscountCode(webshop: Webshop, data: { code: string; email: string | null }) {
    const model = new WebshopDiscountCode();
    model.organizationId = webshop.organizationId;
    model.webshopId = webshop.id;
    model.code = data.code;
    model.email = data.email;
    model.discounts = [Discount.create({})];
    await model.save();
    return model;
}

/** Open the discount codes table of a webshop: webshop overview → Kortingen → Kortingscodes beheren. */
async function openDiscountCodes(page: Page, organization: Organization, webshopName: string) {
    const dashboard = new DashboardPage(page);
    await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
    await dashboard.openTab(DashboardTab.Webshops);
    await page.getByTestId('webshop-menu-item').filter({ hasText: webshopName }).click();
    await page.locator('.st-list-item').filter({ hasText: 'Kortingen' }).click();
    await page.locator('.st-list-item').filter({ hasText: 'Kortingscodes beheren' }).click();
    await page.getByTestId('table').waitFor();
}

test.describe('Webshop discount codes @webshop-discount-codes', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test('lists discount codes and saves an email address for a code', async ({ browser }) => {
        const organization = await createWebshopOrganization('DiscountCodes');
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Discount codes ${WorkerData.id}`,
        });
        await createDiscountCode(webshop, { code: 'SPONSOR-2026', email: 'sponsor@test.be' });
        await createDiscountCode(webshop, { code: 'FRIENDS', email: null });

        const admin = await createAdmin(organization);
        const context = await browser.newContext();
        const page = await context.newPage();
        await loginAs({ page, user: admin });
        await openDiscountCodes(page, organization, webshop.meta.name);

        const table = new TableHelper(page);
        await table.waitForFirstRow();
        await expect(table.getRow('SPONSOR-2026')).toContainText('sponsor@test.be');
        await expect(table.getRow('FRIENDS')).toContainText('Geen e-mailadres');

        // Open the code and add an email address
        await table.getRow('FRIENDS').click();
        const editView = page.getByTestId('save-view').filter({ hasText: 'Kortingscode bewerken' });
        await expect(editView.getByRole('heading', { name: 'Kortingscode bewerken' }).first()).toBeVisible();
        await editView.getByTestId('email-input').fill('friends@test.be');
        await editView.getByTestId('save-button').click();
        await expect(editView).not.toBeVisible();

        await expect(table.getRow('FRIENDS')).toContainText('friends@test.be');

        const saved = await WebshopDiscountCode.where({ webshopId: webshop.id, code: 'FRIENDS' });
        expect(saved[0].email).toBe('friends@test.be');

        // Both codes now have an email, so both are recipients
        await table.toggleSelectAllRows();
        await table.clickAction('E-mail versturen');
        await expect(page.getByRole('heading', { name: 'Nieuw bericht' }).first()).toBeVisible();
        await expect(page.locator('.st-list-item').filter({ hasText: 'Aan:' })).toContainText('2');

        await context.close();
    });

    test('imports codes from a CSV file and updates existing codes by email', async ({ browser }) => {
        const organization = await createWebshopOrganization('DiscountCodesImport');
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Discount codes import ${WorkerData.id}`,
        });
        const existing = await createDiscountCode(webshop, { code: 'SPONSOR-2026', email: 'sponsor@test.be' });
        const friends = await createDiscountCode(webshop, { code: 'FRIENDS', email: null });

        const admin = await createAdmin(organization);
        const context = await browser.newContext();
        const page = await context.newPage();
        await loginAs({ page, user: admin });
        await openDiscountCodes(page, organization, webshop.meta.name);

        const table = new TableHelper(page);
        await table.waitForFirstRow();
        await table.clickAction('Importeren');

        const importView = page.getByTestId('save-view').filter({ has: page.getByRole('heading', { name: 'Kortingscodes importeren' }) });
        await importView.locator('input[type="file"]').setInputFiles({
            name: 'codes.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from('E-mailadres,Code,Omschrijving,Maximum\nsponsor@test.be,,Hoofdsponsor,5\nnew@test.be,NEW-CODE,Nieuwe sponsor,\n,friends,Vrienden,\n', 'utf-8'),
        });

        // The columns are matched on their header
        await expect(importView.getByRole('combobox').first()).toHaveValue('0');
        await importView.getByTestId('save-button').first().click();
        await expect(importView).not.toBeVisible();

        await expect(table.getRow('NEW-CODE')).toContainText('new@test.be');
        await expect(table.getRow('SPONSOR-2026')).toContainText('Hoofdsponsor');
        await expect(table.getRow('FRIENDS')).toContainText('Vrienden');

        const updated = await WebshopDiscountCode.getByID(existing.id);
        expect(updated?.code).toBe('SPONSOR-2026');
        expect(updated?.description).toBe('Hoofdsponsor');
        expect(updated?.maximumUsage).toBe(5);

        const created = await WebshopDiscountCode.where({ webshopId: webshop.id, code: 'NEW-CODE' });
        expect(created[0].email).toBe('new@test.be');
        expect(created[0].maximumUsage).toBeNull();

        // A row with an existing code updates that code instead of creating a duplicate
        const updatedFriends = await WebshopDiscountCode.where({ webshopId: webshop.id, code: 'FRIENDS' });
        expect(updatedFriends).toHaveLength(1);
        expect(updatedFriends[0].id).toBe(friends.id);
        expect(updatedFriends[0].description).toBe('Vrienden');

        await context.close();
    });
});
