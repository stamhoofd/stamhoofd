// test should always be imported first
import { test, setup } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import type { Group, Organization, User } from '@stamhoofd/models';
import { GroupFactory, MemberFactory, OrganizationFactory, OrganizationRegistrationPeriodFactory, Platform, RegistrationFactory, RegistrationPeriod, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import { appToUri, GroupCategory, GroupCategorySettings, PermissionLevel, Permissions, PermissionsResourceKey, PermissionsResourceType, ResourcePermissions, Token as TokenStruct, TranslatedString, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

type Scenario = {
    organization: Organization;
    user: User;
    /** Group in the period the organization itself is still in */
    organizationPeriodGroup: Group;
    organizationPeriodMember: string;
    /** Group in the (newer) platform period, which the organization has not rolled over to */
    platformPeriodGroup: Group;
    platformPeriodMember: string;
    platformPeriodName: string;
};

/**
 * In platform mode a $currentPeriod grant reaches the platform's period as well as the
 * organization's own one, which matters while an organization has not rolled over yet.
 */
test.describe('Period scoped permissions in platform mode @period-permissions-platform', () => {
    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    async function addGroup({ organization, period, label }: {
        organization: Organization;
        period: RegistrationPeriod;
        label: string;
    }) {
        const organizationPeriod = await new OrganizationRegistrationPeriodFactory({
            organization,
            period,
        }).create();

        const group = await new GroupFactory({
            organization,
            period,
            name: new TranslatedString(`Kapoenen ${label}`),
        }).create();

        // A group only shows up in the members menu through a category
        const category = GroupCategory.create({
            settings: GroupCategorySettings.create({ name: `Takken ${label}` }),
            groupIds: [group.id],
        });
        organizationPeriod.settings.categories.push(category);
        organizationPeriod.settings.rootCategory?.categoryIds.push(category.id);
        await organizationPeriod.save();

        const memberName = `Lid-${label}`;
        const member = await new MemberFactory({ organization, firstName: memberName, lastName: 'Test' }).create();
        await new RegistrationFactory({ member, group }).create();

        return { group, memberName };
    }

    async function seedScenario(seedId: string): Promise<Scenario> {
        TestUtils.setPermanentEnvironment('userMode', 'platform');

        const runId = `${WorkerData.id}-${seedId}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
        const year = new Date().getFullYear() - 1;

        // The period the organization is still in
        const organizationPeriod = await new RegistrationPeriodFactory({
            startDate: new Date(year - 1, 0, 1, 0, 0, 0, 0),
            endDate: new Date(year - 1, 11, 31, 23, 59, 59, 999),
        }).create();
        organizationPeriod.customName = `Werkjaar organisatie ${runId}`;
        await organizationPeriod.save();

        // The period the platform already moved on to
        const platformPeriod = await new RegistrationPeriodFactory({
            startDate: new Date(year, 0, 1, 0, 0, 0, 0),
            endDate: new Date(year, 11, 31, 23, 59, 59, 999),
        }).create();
        const platformPeriodName = `Werkjaar platform ${runId}`;
        platformPeriod.customName = platformPeriodName;
        await platformPeriod.save();

        const platform = await Platform.getForEditing();
        platform.periodId = platformPeriod.id;
        await platform.save();

        const organization = await new OrganizationFactory({
            name: `Platform Period Organization ${runId}`,
            uri: `platform-period-${runId}`,
            period: organizationPeriod,
        }).create();

        const own = await addGroup({ organization, period: organizationPeriod, label: `eigen-${runId}` });
        const platformOne = await addGroup({ organization, period: platformPeriod, label: `platform-${runId}` });

        const user = await new UserFactory({
            firstName: 'Platform',
            lastName: 'Period Admin',
            email: `platform-period-${runId}@test.be`,
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.None,
                resources: new Map([[
                    PermissionsResourceType.Groups,
                    new Map([[PermissionsResourceKey.CurrentPeriod, ResourcePermissions.create({ level: PermissionLevel.Write })]]),
                ]]),
            }),
        }).create();

        return {
            organization,
            user,
            organizationPeriodGroup: own.group,
            organizationPeriodMember: own.memberName,
            platformPeriodGroup: platformOne.group,
            platformPeriodMember: platformOne.memberName,
            platformPeriodName,
        };
    }

    async function openDashboard({ page, scenario }: { page: Page; scenario: Scenario }) {
        const token = await SessionService.createSession(scenario.user);
        const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
        // In platform mode the session is stored platform wide, not per organization
        await page.addInitScript(({ tokenString }) => {
            window.localStorage.setItem('token-platform', tokenString);
        }, { tokenString });

        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${scenario.organization.uri}`);

        // Unlike organization mode, platform mode opens on the start tab
        await page.getByTestId('tab-button').filter({ hasText: 'Leden' }).click();
        await expect(page.getByTestId('members-menu').first()).toBeVisible();
    }

    async function openGroupMembers({ page, group }: { page: Page; group: Group }) {
        const menuItem = page.locator(`[id="${group.id}"]`);
        await expect(menuItem).toBeVisible();
        await menuItem.click();

        const membersItem = page.locator('.st-list-item', { hasText: 'Ingeschreven leden' }).first();
        await expect(membersItem).toBeVisible();
        await membersItem.click();

        await expect(page.getByTestId('table')).toBeVisible();
    }

    async function expectWriteAction({ page, memberName }: { page: Page; memberName: string }) {
        const row = page.getByTestId('table').locator('[data-testid="table-row"]:visible').filter({ hasText: memberName });
        await expect(row).toHaveCount(1);

        await row.click({ button: 'right' });

        const action = page.getByTestId('context-menu-item-title').filter({ hasText: 'Gegevens bewerken' });
        await expect(action).toBeVisible();
        await action.click();

        const editView = page.getByTestId('member-step');
        await expect(editView).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(editView).toBeHidden();
    }

    test('a $currentPeriod grant reaches the organization period and the platform period', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario('platform-current-period');

        await page.setViewportSize({ width: 1280, height: 800 });
        await openDashboard({ page, scenario });

        // The period the organization itself is in
        await openGroupMembers({ page, group: scenario.organizationPeriodGroup });
        await expectWriteAction({ page, memberName: scenario.organizationPeriodMember });

        // The platform period counts as in use too, so the same grant reaches it
        await page.getByTestId('members-menu').locator('.footer button').first().click();
        const item = page.getByTestId('context-menu-item-title').filter({ hasText: scenario.platformPeriodName });
        await expect(item).toBeVisible();
        await item.click();

        await openGroupMembers({ page, group: scenario.platformPeriodGroup });
        await expectWriteAction({ page, memberName: scenario.platformPeriodMember });
    });
});
