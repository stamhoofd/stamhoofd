// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import type { User } from '@stamhoofd/models';
import { Organization, Platform, UserFactory } from '@stamhoofd/models';
import {
    AccessRight,
    OrganizationTag,
    PermissionLevel,
    Permissions,
    PermissionsResourceType,
    ResourcePermissions,
    Token as TokenStruct,
    Version,
} from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { TableHelper, WorkerData } from '../helpers/index.js';

async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await SessionService.createSession(user);
    const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));

    await page.addInitScript(({ tokenString }) => {
        window.localStorage.setItem('token-platform', tokenString);
    }, { tokenString });
}

test.describe('Creating organizations as a tag admin @create-organization-tag-admin', () => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const provinceTag = OrganizationTag.create({ name: `Provincie ${suffix}` });
    const managedTag = OrganizationTag.create({ name: `Regio X ${suffix}` });
    const otherManagedTag = OrganizationTag.create({ name: `Regio Y ${suffix}` });
    const siblingTag = OrganizationTag.create({ name: `Regio Z ${suffix}` });
    const unrelatedTag = OrganizationTag.create({ name: `Andere tag ${suffix}` });
    provinceTag.childTags = [managedTag.id, siblingTag.id];

    let admin: User;
    let originalTags: OrganizationTag[];

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');

        const platform = await Platform.getForEditing();
        originalTags = platform.config.tags;
        platform.config.tags = [provinceTag, managedTag, siblingTag, otherManagedTag, unrelatedTag];
        await platform.save();

        const tagPermissions = ResourcePermissions.create({
            level: PermissionLevel.Full,
            accessRights: [AccessRight.PlatformCreateOrganizations],
        });
        admin = await new UserFactory({
            email: `tag-admin-${suffix}@stamhoofd.be`,
            globalPermissions: Permissions.create({
                resources: new Map([
                    [PermissionsResourceType.OrganizationTags, new Map([
                        [managedTag.id, tagPermissions],
                        [otherManagedTag.id, tagPermissions.clone()],
                    ])],
                ]),
            }),
        }).create();
    });

    test.afterAll(async () => {
        const platform = await Platform.getForEditing();
        platform.config.tags = originalTags;
        await platform.save();
    });

    test('An admin with access to two tags only sees those tags and can create an organization with them', async ({ page }) => {
        await loginAs({ page, user: admin });
        await page.goto(`${WorkerData.urls.dashboard}/platform`);
        await page.locator('[data-testid="tab-button"][data-tab-id="organizations"]:visible').first().click();

        // The menu only lists the tags the admin has access to
        const menu = page.locator('.st-menu');
        await expect(menu.getByRole('button', { name: managedTag.name })).toBeVisible();
        await expect(menu.getByRole('button', { name: otherManagedTag.name })).toBeVisible();
        for (const tag of [provinceTag, siblingTag, unrelatedTag]) {
            await expect(menu.getByText(tag.name)).toHaveCount(0);
        }

        await menu.getByRole('button', { name: managedTag.name }).click();
        await page.locator('[data-testid="table"]:visible button.icon.add').click();

        // The form only lists the managed tags and their parent, with the opened tag already selected
        const popup = page.locator('div.popup.focused').last();
        await expect(popup.getByRole('heading', { name: 'Nieuwe vereniging' }).first()).toBeVisible();
        for (const tag of [provinceTag, managedTag, otherManagedTag]) {
            await expect(popup.getByRole('heading', { name: tag.name, exact: true })).toBeVisible();
        }
        for (const tag of [siblingTag, unrelatedTag]) {
            await expect(popup.getByText(tag.name)).toHaveCount(0);
        }
        await expect(popup.locator('label').filter({ hasText: managedTag.name }).locator('input[type="checkbox"]')).toBeChecked();

        const name = `Vereniging ${suffix}`;
        await popup.locator('#organization-name').fill(name);
        await popup.locator('input[name="street-address"]').fill('Teststraat 1');
        await popup.locator('input[name="postal-code"]').fill('2000');
        await popup.locator('input[name="city"]').fill('Antwerpen');
        await popup.locator('input[name="city"]').blur();
        await popup.locator('[data-testid="save-button"]:visible').first().click();
        await expect(popup).toBeHidden();

        const organization = await Organization.select().where('name', name).first(true);
        expect(organization.meta.tags).toEqual([provinceTag.id, managedTag.id]);

        // Editing the organization only shows the accessible tags, and they cannot be changed
        const table = new TableHelper(page);
        await table.getRow(name).click();
        await page.locator('button.icon.edit:visible').click();
        const editPopup = page.locator('div.popup.focused').last();
        await expect(editPopup.locator('#organization-name')).toHaveValue(name);
        for (const tag of [provinceTag, managedTag, otherManagedTag]) {
            await expect(editPopup.getByRole('heading', { name: tag.name, exact: true })).toBeVisible();
        }
        for (const tag of [siblingTag, unrelatedTag]) {
            await expect(editPopup.getByText(tag.name)).toHaveCount(0);
        }
        await expect(editPopup.locator('label').filter({ hasText: managedTag.name }).locator('input[type="checkbox"]')).toBeDisabled();
        await page.keyboard.press('Escape');
        await expect(page.locator('#organization-name')).toHaveCount(0);

        // Close the organization popup
        await page.keyboard.press('Escape');
        await expect(page.locator('div.popup')).toHaveCount(0);

        // Changing tags requires full platform access, so the tag actions are hidden
        await table.toggleSelectAllRows();
        await page.locator('[data-testid="more-button"]:visible').click();
        const menuItems = page.getByTestId('context-menu-item-title');
        await expect(menuItems.filter({ hasText: 'Nieuwe vereniging' })).toBeVisible();
        await expect(menuItems.filter({ hasText: 'Tag toevoegen' })).toHaveCount(0);
        await expect(menuItems.filter({ hasText: 'Tag verwijderen' })).toHaveCount(0);
    });
});
