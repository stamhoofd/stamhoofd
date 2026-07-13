// test should always be imported first
import { test, setup } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import type { Organization, User } from '@stamhoofd/models';
import { GroupFactory, MemberFactory, OrganizationFactory, OrganizationRegistrationPeriodFactory, RegistrationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { appToUri, GroupCategory, GroupCategorySettings, PermissionLevel, Permissions, STPackageBundle, Token as TokenStruct, TranslatedString, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

type Scenario = {
    organization: Organization;
    user: User;
    // Name of the period we switch to and mark as the current one
    otherPeriodName: string;
    names: {
        // Member registered in the (initial) current period
        currentPeriod: string;
        // Member registered in the period we switch to
        otherPeriod: string;
    };
};

test.describe('Switching the current period from the members menu @members-period-switch', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    async function addGroupWithMember({ organization, period, organizationPeriod, memberName, groupName }: {
        organization: Organization;
        period: RegistrationPeriod;
        organizationPeriod: Awaited<ReturnType<OrganizationRegistrationPeriodFactory['create']>>;
        memberName: string;
        groupName: string;
    }) {
        const group = await new GroupFactory({
            organization,
            period,
            name: new TranslatedString(groupName),
        }).create();

        // The group must be part of a category to show up in the period menu
        const category = GroupCategory.create({
            settings: GroupCategorySettings.create({ name: 'Takken' }),
            groupIds: [group.id],
        });
        organizationPeriod.settings.categories.push(category);
        organizationPeriod.settings.rootCategory?.categoryIds.push(category.id);
        await organizationPeriod.save();

        const member = await new MemberFactory({
            organization,
            firstName: memberName,
            lastName: 'Lid',
        }).create();
        await new RegistrationFactory({ member, group }).create();
    }

    async function seedScenario(seedId: string): Promise<Scenario> {
        const runId = `${WorkerData.id}-${seedId}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

        const organization = await new OrganizationFactory({
            name: `Period Switch Organization ${runId}`,
            uri: `period-switch-organization-${runId}`,
            packages: [STPackageBundle.Members],
        }).create();
        await STPackageService.updateOrganizationPackages(organization.id);

        // Custom names make the periods uniquely identifiable in the period switcher,
        // independent of the (date based) default period naming. The switcher only lists
        // this organization's periods, so constant names are safe across parallel workers.
        const currentPeriodName = 'Huidig testwerkjaar';
        const otherPeriodName = 'Volgend testwerkjaar';

        // The current period is the one created together with the organization
        const currentPeriod = await RegistrationPeriod.getByID(organization.periodId);
        if (!currentPeriod) {
            throw new Error('Missing registration period for organization');
        }
        currentPeriod.customName = currentPeriodName;
        await currentPeriod.save();
        const currentOrganizationPeriod = await new OrganizationRegistrationPeriodFactory({
            organization,
            period: currentPeriod,
        }).create();

        // A second period the organization can switch to
        const otherPeriod = await new RegistrationPeriodFactory({
            organization,
            startDate: new Date(2025, 0, 1, 0, 0, 0, 0),
            endDate: new Date(2025, 11, 31, 23, 59, 59, 999),
        }).create();
        otherPeriod.customName = otherPeriodName;
        await otherPeriod.save();
        const otherOrganizationPeriod = await new OrganizationRegistrationPeriodFactory({
            organization,
            period: otherPeriod,
        }).create();

        const names = {
            currentPeriod: `Huidig-${runId}`,
            otherPeriod: `Ander-${runId}`,
        };

        await addGroupWithMember({
            organization,
            period: currentPeriod,
            organizationPeriod: currentOrganizationPeriod,
            memberName: names.currentPeriod,
            groupName: 'Huidige tak',
        });

        await addGroupWithMember({
            organization,
            period: otherPeriod,
            organizationPeriod: otherOrganizationPeriod,
            memberName: names.otherPeriod,
            groupName: 'Andere tak',
        });

        const user = await new UserFactory({
            firstName: 'Period',
            lastName: 'Switch Admin',
            email: `period-switch-admin-${runId}@test.be`,
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();

        return {
            organization,
            user,
            otherPeriodName,
            names,
        };
    }

    async function loginAs({ page, user }: { page: Page; user: User }) {
        const token = await Token.createToken(user);
        const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));

        const organizationId = user.organizationId;
        await page.addInitScript(({ organizationId, tokenString }) => {
            window.localStorage.setItem('token-' + organizationId, tokenString);
        }, { organizationId, tokenString });
    }

    async function openMembersMenu({ page, scenario }: { page: Page; scenario: Scenario }) {
        await loginAs({ page, user: scenario.user });
        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${scenario.organization.uri}`);

        // The members menu (master pane) is the default view in organization mode
        const membersMenu = page.getByTestId('members-menu');
        await expect(membersMenu.first()).toBeVisible();
        return membersMenu;
    }

    // Opens the period switcher, navigates to the other period and marks it as
    // the current one, then returns to the current-period menu.
    async function switchToOtherPeriodAsCurrent({ page, scenario }: { page: Page; scenario: Scenario }) {
        // The footer button (only shown on the current-period menu) opens the period switcher
        await page.getByTestId('members-menu').locator('.footer button').first().click();

        const otherPeriodItem = page.getByTestId('context-menu-item-title').filter({ hasText: scenario.otherPeriodName });
        await expect(otherPeriodItem).toBeVisible();
        await otherPeriodItem.click();

        // On the other period's menu, mark it as the current period
        const setCurrentButton = page.locator('button.menu-button', { hasText: 'Instellen als huidig werkjaar' });
        await expect(setCurrentButton).toBeVisible();
        await setCurrentButton.click();

        // Confirm the switch in the centered message dialog
        await page.getByTestId('centered-message').getByRole('button', { name: 'Overschakelen' }).click();
    }

    test('on desktop it opens the members overview of the new period', async ({ page }) => {
        test.setTimeout(90_000);
        const scenario = await seedScenario('desktop');
        const { names } = scenario;

        // A wide viewport keeps the split view expanded (not collapsed)
        await page.setViewportSize({ width: 1280, height: 800 });

        await openMembersMenu({ page, scenario });
        await switchToOtherPeriodAsCurrent({ page, scenario });

        // Because the split view is expanded, changing the current period navigates
        // to the members overview of the new period automatically.
        const table = page.getByTestId('table');
        await expect(table).toBeVisible();

        const visibleRows = table.locator('[data-testid="table-row"]:visible');
        await visibleRows.first().waitFor();

        // The overview is scoped to the newly selected period: only its member is shown
        await expect(page.locator('.title-suffix')).toHaveText('1');
        await expect(visibleRows.filter({ hasText: names.otherPeriod })).toHaveCount(1);
        await expect(visibleRows.filter({ hasText: names.currentPeriod })).toHaveCount(0);
    });

    test('on mobile it stays on the menu without opening an overview', async ({ page }) => {
        test.setTimeout(90_000);
        const scenario = await seedScenario('mobile');

        // A narrow viewport collapses the split view (like on mobile)
        await page.setViewportSize({ width: 400, height: 850 });

        await openMembersMenu({ page, scenario });
        await switchToOtherPeriodAsCurrent({ page, scenario });

        // We return to the current-period menu, now showing the newly selected period,
        // and no members overview is opened (nothing to show on a collapsed split view).
        const membersMenu = page.getByTestId('members-menu');
        await expect(membersMenu).toBeVisible();
        await expect(membersMenu.locator('.footer')).toContainText(scenario.otherPeriodName);
        await expect(page.getByTestId('table')).toHaveCount(0);
    });
});
