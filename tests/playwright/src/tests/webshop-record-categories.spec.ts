// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import type { User } from '@stamhoofd/models';
import { Organization, OrganizationFactory, UserFactory, Webshop } from '@stamhoofd/models';
import { Permissions, RecordType, STPackageBundle, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { TestUtils } from '@stamhoofd/test-utils';
import { DashboardPage, DashboardTab, WorkerData } from '../helpers/index.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await SessionService.createSession(user);
    const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
    await page.addInitScript(({ organizationId, tokenString }) => {
        window.localStorage.setItem('token-' + organizationId, tokenString);
    }, { organizationId: user.organizationId, tokenString });
}

function topView(page: Page) {
    return page.locator('.st-view').last();
}

async function addRecord(page: Page, name: string, typeName: string, addButton = 'records-add-button') {
    await topView(page).getByTestId(addButton).first().click();
    await page.getByTestId('context-menu-item-title').filter({ hasText: typeName }).click();
    await expect(topView(page).getByRole('heading', { name: 'Nieuwe vraag', level: 1 }).first()).toBeVisible();
    await topView(page).locator('input[placeholder^="bv. Toestemming"]').first().fill(name);
    await topView(page).getByTestId('save-button').click();
    await expect(topView(page).getByRole('heading', { name: 'Nieuwe vraag', level: 1 })).toHaveCount(0);
}

test.describe('Webshop checkout steps @webshop-record-categories', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test('Questions and child categories can be added and edited in a checkout step', async ({ page }) => {
        const created = await new OrganizationFactory({
            name: `RecordCategoryShop${WorkerData.id}-${Date.now()}`,
            packages: [STPackageBundle.Webshops],
        }).create();
        await STPackageService.updateOrganizationPackages(created.id);
        const organization = (await Organization.getByID(created.id))!;

        const { webshop } = await TestWebshops.create({
            organization,
            name: `Steps ${WorkerData.id}`,
            productCount: 1,
        });

        const admin = await new UserFactory({
            email: `admin-${WorkerData.id}-${Date.now()}@test.be`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        await loginAs({ page, user: admin });

        const dashboard = new DashboardPage(page);
        await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
        await dashboard.openTab(DashboardTab.Webshops);
        await page.getByTestId('webshop-menu-item').filter({ hasText: webshop.meta.name }).click();
        await page.getByRole('heading', { name: 'Contactgegevens' }).click();

        // Built-in contact person fields are added from the navigation bar
        await topView(page).getByTestId('customer-settings-add-button').click();
        await page.getByTestId('context-menu-item-title').filter({ hasText: 'GSM-nummer' }).click();
        await expect(topView(page).getByTestId('customer-field-phone')).toBeVisible();

        // The preview shows the contact person step of the webshop
        await topView(page).getByTestId('customer-settings-preview-button').click();
        await expect(topView(page).getByRole('heading', { name: 'Contactgegevens', level: 1 }).first()).toBeVisible();
        await topView(page).getByTestId('close-button').click();
        await expect(topView(page).getByRole('heading', { name: 'Contactgegevens', level: 1 }).first()).toBeVisible();

        // New checkout step with one root question
        await topView(page).getByText('Nieuwe stap').click();
        await topView(page).locator('input[placeholder="Titel"]').first().fill('Kamp');
        // The empty state offers the same add menu as the navigation bar
        await addRecord(page, 'Opmerking', 'Tekstveld (één lijn)', 'empty-records-add-button');
        await expect(topView(page).getByText('Opmerking', { exact: true })).toBeVisible();

        // Edit that question
        await topView(page).getByText('Opmerking', { exact: true }).click();
        await expect(topView(page).getByRole('heading', { name: 'Vraag bewerken', level: 1 }).first()).toBeVisible();
        await topView(page).locator('input[placeholder^="bv. Toestemming"]').first().fill('Opmerking voor de leiding');
        await topView(page).getByTestId('save-button').click();
        await expect(topView(page).getByText('Opmerking voor de leiding', { exact: true })).toBeVisible();

        // Right click a question to make it optional
        await topView(page).locator('.record-row').filter({ hasText: 'Opmerking voor de leiding' }).click({ button: 'right' });
        await page.getByTestId('context-menu-item-title').filter({ hasText: 'Optioneel' }).click();
        await expect(topView(page).locator('.record-row').filter({ hasText: 'Opmerking voor de leiding' })).toContainText('optioneel', { ignoreCase: true });

        // Child category with its own question
        await topView(page).getByTestId('records-add-button').first().click();
        await page.getByTestId('context-menu-item-title').filter({ hasText: 'Categorie' }).click();
        await expect(topView(page).getByRole('heading', { name: 'Nieuwe categorie', level: 1 }).first()).toBeVisible();
        await topView(page).locator('input[placeholder="Titel"]').first().fill('Noodcontact');
        await addRecord(page, 'Noodnummer', 'Telefoonnummer');

        // A child category is previewed as part of a questionnaire, and closing a preview never asks for confirmation
        await topView(page).locator('button.icon.eye').click();
        await expect(topView(page).getByRole('heading', { name: 'Voorbeeld', level: 1 }).first()).toBeVisible();
        await expect(topView(page).getByRole('heading', { name: 'Noodcontact', level: 2 })).toBeVisible();
        await topView(page).getByRole('textbox').first().fill('0470 00 00 00');
        await topView(page).getByTestId('close-button').click();
        await expect(topView(page).getByRole('heading', { name: 'Nieuwe categorie', level: 1 }).first()).toBeVisible();
        await expect(page.getByTestId('centered-message')).toHaveCount(0);
        await topView(page).getByTestId('save-button').click();
        await expect(topView(page).getByText('Noodcontact', { exact: true })).toBeVisible();
        await expect(topView(page).getByText('Noodnummer', { exact: true })).toBeVisible();

        // The step is the only root category: its child categories are listed directly, without the step's name
        await topView(page).locator('.record-row').filter({ hasText: 'Noodnummer' }).click({ button: 'right' });
        await page.getByTestId('context-menu-item-title').filter({ hasText: 'Verplaats naar' }).hover();
        await expect(page.getByTestId('context-menu-item-title').filter({ hasText: 'Algemene vraag' })).toBeVisible();
        await expect(page.getByTestId('context-menu-item-title').filter({ hasText: 'Kamp' })).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('context-menu-item-title')).toHaveCount(0);

        // Save the step, then the webshop settings
        await topView(page).getByTestId('save-button').click();
        await expect(topView(page).getByText('Kamp', { exact: true })).toBeVisible();
        await topView(page).getByTestId('save-button').click();

        await expect.poll(async () => (await Webshop.getByID(webshop.id))!.meta.recordCategories.length).toBe(1);
        const [step] = (await Webshop.getByID(webshop.id))!.meta.recordCategories;
        expect(step.name.toString()).toBe('Kamp');
        expect(step.records.map(r => [r.name.toString(), r.type, r.required])).toEqual([['Opmerking voor de leiding', RecordType.Text, false]]);
        expect(step.childCategories.map(c => c.name.toString())).toEqual(['Noodcontact']);
        expect(step.childCategories[0].records.map(r => [r.name.toString(), r.type])).toEqual([['Noodnummer', RecordType.Phone]]);
    });
});
