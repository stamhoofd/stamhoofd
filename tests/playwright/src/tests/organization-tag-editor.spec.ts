// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import { Platform, UserFactory } from '@stamhoofd/models';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { OrganizationTag, Permissions, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

function editor(page: Page) {
    return page.locator('div.popup.focused').last().getByTestId('save-view');
}

async function saveEditor(page: Page) {
    const count = await page.locator('div.popup').count();
    await editor(page).getByTestId('save-button').click();
    await expect(page.locator('div.popup')).toHaveCount(count - 1);
}

async function openTags(page: Page) {
    await page.goto(`${WorkerData.urls.dashboard}/platform`);
    await page.locator('[data-testid="tab-button"][data-tab-id="organizations"]:visible').first().click();
    await page.locator('.st-menu:visible button.icon.settings').click();
    await expect(editor(page).getByRole('heading', { name: 'Hiërachie', exact: true }).last()).toBeVisible();
}

test.describe('Organization tag editor @organization-tag-editor', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');
    });

    test.beforeEach(async ({ page }) => {
        const child = OrganizationTag.create({ name: 'Existing child' });
        const parent = OrganizationTag.create({ name: 'Parent tag', childTags: [child.id] });
        const platform = await Platform.getForEditing();
        platform.config.tags = [parent, child];
        await platform.save();

        const user = await new UserFactory({
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await SessionService.createSession(user);
        const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
        await page.addInitScript(({ tokenString }) => {
            window.localStorage.setItem('token-platform', tokenString);
        }, { tokenString });
        await page.setViewportSize({ width: 1280, height: 800 });
    });

    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    test('creates nested tags and persists edits to an existing child', async ({ page }) => {
        await openTags(page);
        await editor(page).getByRole('heading', { name: 'Parent tag', exact: true }).click();
        await editor(page).getByRole('button', { name: 'Voeg tag toe' }).click();
        await editor(page).getByPlaceholder('Naam van deze tag').fill('New child');
        await editor(page).getByRole('button', { name: 'Voeg tag toe' }).click();
        await editor(page).getByPlaceholder('Naam van deze tag').fill('New grandchild');
        await saveEditor(page);
        await expect(editor(page).getByRole('heading', { name: 'New grandchild', exact: true })).toBeVisible();
        await saveEditor(page);
        await expect(editor(page).getByRole('heading', { name: 'New child', exact: true })).toBeVisible();
        await saveEditor(page);
        await saveEditor(page);

        await page.reload();
        await openTags(page);
        await editor(page).getByRole('heading', { name: 'Parent tag', exact: true }).click();
        await editor(page).getByRole('heading', { name: 'New child', exact: true }).click();
        await expect(editor(page).getByRole('heading', { name: 'New grandchild', exact: true })).toBeVisible();
        await editor(page).getByPlaceholder('Naam van deze tag').fill('Renamed child');
        await saveEditor(page);
        await saveEditor(page);
        await saveEditor(page);

        const tags = (await Platform.getForEditing()).config.tags;
        const parent = tags.find(tag => tag.name === 'Parent tag')!;
        const child = tags.find(tag => tag.name === 'Renamed child')!;
        const grandchild = tags.find(tag => tag.name === 'New grandchild')!;
        expect(parent.childTags).toContain(child.id);
        expect(child.childTags).toEqual([grandchild.id]);
        expect(tags.some(tag => tag.name === 'New child')).toBe(false);
    });

    test('keeps unsaved child changes when closing is cancelled and discards them on confirmation', async ({ page }) => {
        await openTags(page);
        await editor(page).getByRole('heading', { name: 'Parent tag', exact: true }).click();
        await editor(page).getByRole('heading', { name: 'Existing child', exact: true }).click();
        await editor(page).getByPlaceholder('Naam van deze tag').fill('Unsaved child');
        const count = await page.locator('div.popup').count();
        await editor(page).getByTestId('close-button').click();

        const confirmation = page.getByTestId('centered-message');
        await expect(confirmation).toContainText('Ben je zeker dat je wilt sluiten zonder op te slaan?');
        await confirmation.getByRole('button', { name: 'Annuleren', exact: true }).click();
        await expect(confirmation).toBeHidden();
        await expect(editor(page).getByPlaceholder('Naam van deze tag')).toHaveValue('Unsaved child');
        await expect(page.locator('div.popup')).toHaveCount(count);

        await editor(page).getByTestId('close-button').click();
        await confirmation.getByRole('button', { name: 'Niet opslaan', exact: true }).click();
        await expect(page.locator('div.popup')).toHaveCount(count - 1);
        await expect(editor(page).getByPlaceholder('Naam van deze tag')).toHaveValue('Parent tag');
        await expect(editor(page).getByRole('heading', { name: 'Existing child', exact: true })).toBeVisible();
        await expect(editor(page).getByRole('heading', { name: 'Unsaved child', exact: true })).toHaveCount(0);
        await expect(editor(page).getByTestId('save-button')).toBeDisabled();
        await editor(page).getByRole('heading', { name: 'Existing child', exact: true }).click();
        await expect(editor(page).getByPlaceholder('Naam van deze tag')).toHaveValue('Existing child');
    });
});
