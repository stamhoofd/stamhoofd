// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

import { expect } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { GroupFactory, OrganizationFactory, OrganizationRegistrationPeriodFactory, RegistrationPeriod, UserFactory } from '@stamhoofd/models';
import { appToUri, GroupCategory, GroupCategorySettings, PermissionLevel, Permissions, STPackageBundle, Token as TokenStruct, TranslatedString, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

test.describe('Nested category navigation @category-navigation', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    for (const width of [1280, 400]) {
        test(`opens subcategories and replaces them with their parent at ${width}px`, async ({ page }) => {
            const organization = await new OrganizationFactory({ packages: [STPackageBundle.Members] }).create();
            await STPackageService.updateOrganizationPackages(organization.id);
            const period = await RegistrationPeriod.getByID(organization.periodId);
            if (!period) {
                throw new Error('Missing registration period');
            }
            const organizationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period }).create();
            const group = await new GroupFactory({ organization, period, name: new TranslatedString('Child group') }).create();
            const siblingGroup = await new GroupFactory({ organization, period, name: new TranslatedString('Sibling group') }).create();
            const child = GroupCategory.create({
                settings: GroupCategorySettings.create({ name: 'Child category' }),
                groupIds: [group.id],
            });
            const sibling = GroupCategory.create({
                settings: GroupCategorySettings.create({ name: 'Sibling category' }),
                groupIds: [siblingGroup.id],
            });
            const parent = GroupCategory.create({
                settings: GroupCategorySettings.create({ name: 'Parent category' }),
                categoryIds: [child.id, sibling.id],
            });
            organizationPeriod.settings.categories.push(parent, child, sibling);
            organizationPeriod.settings.rootCategory!.categoryIds.push(parent.id);
            await organizationPeriod.save();

            const user = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const token = await SessionService.createSession(user);
            const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
            await page.addInitScript(({ organizationId, tokenString }) => {
                window.localStorage.setItem('token-' + organizationId, tokenString);
            }, { organizationId: organization.id, tokenString });
            await page.setViewportSize({ width, height: 850 });
            await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}`);
            await page.getByTestId('members-menu').locator('button.title').filter({ hasText: 'Parent category' }).getByText('Parent category', { exact: true }).click();

            const view = page.locator('.category-view:visible').last();
            await expect(view.locator('main > h1')).toContainText('Parent category');
            await view.locator('.st-list-item', { hasText: 'Child category' }).click();
            await expect(view.locator('main > h1')).toContainText('Child category');
            await expect(view.getByRole('heading', { name: 'Child group', exact: true })).toBeVisible();
            await expect(view.getByRole('heading', { name: 'Sibling group', exact: true })).toHaveCount(0);

            await view.locator('main > h1').click();
            await page.getByTestId('context-menu-item-title').filter({ hasText: 'Parent category' }).click();
            await expect(view.locator('main > h1')).toContainText('Parent category');
            await expect(page.locator('.category-view:visible')).toHaveCount(1);
            await view.locator('.st-list-item', { hasText: 'Sibling category' }).click();
            await expect(view.locator('main > h1')).toContainText('Sibling category');
            await expect(view.getByRole('heading', { name: 'Sibling group', exact: true })).toBeVisible();
            await expect(view.getByRole('heading', { name: 'Child group', exact: true })).toHaveCount(0);
        });
    }
});
