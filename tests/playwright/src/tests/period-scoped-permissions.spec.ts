// test should always be imported first
import { test, setup } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import type { Group, Organization, User } from '@stamhoofd/models';
import { EventFactory, GroupFactory, MemberFactory, OrganizationFactory, OrganizationRegistrationPeriodFactory, RegistrationFactory, RegistrationPeriod, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import { appToUri, GroupCategory, GroupCategorySettings, GroupType, PermissionLevel, Permissions, PermissionsResourceKey, PermissionsResourceType, ResourcePermissions, STPackageBundle, Token as TokenStruct, TranslatedString, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

type PeriodFixture = {
    period: RegistrationPeriod;
    periodName: string;
    /** Year of the event of this period, used to pick it in the calendar year selector */
    eventYear: number;
    categoryId: string;
    /** Group inside the granted category */
    group: Group;
    groupName: string;
    memberName: string;
    /** Group outside the granted category, used for the negative cases */
    otherGroup: Group;
    otherGroupName: string;
    otherMemberName: string;
    eventName: string;
    eventId: string;
    /** Member registered in the event's registration group */
    eventMemberName: string;
};

type Scenario = {
    organization: Organization;
    current: PeriodFixture;
    previous: PeriodFixture;
};

/** Permissions granting Write on a single resource */
function resourcePermissions(type: PermissionsResourceType, id: string) {
    return Permissions.create({
        level: PermissionLevel.None,
        resources: new Map([[
            type,
            new Map([[id, ResourcePermissions.create({ level: PermissionLevel.Write })]]),
        ]]),
    });
}

test.describe('Period scoped resource permissions @period-permissions', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    async function seedPeriod({ organization, period, periodName, label, withEventRegistrations }: {
        organization: Organization;
        period: RegistrationPeriod;
        periodName: string;
        label: string;
        /**
         * Gives the event a registration group. Off by default: an event with a group is matched
         * differently by the calendar filters, which would change what the other tests assert.
         */
        withEventRegistrations: boolean;
    }): Promise<PeriodFixture> {
        const organizationPeriod = await new OrganizationRegistrationPeriodFactory({
            organization,
            period,
        }).create();

        const groupName = `Kapoenen ${label}`;
        const otherGroupName = `Jonggivers ${label}`;

        const group = await new GroupFactory({
            organization,
            period,
            name: new TranslatedString(groupName),
        }).create();

        const otherGroup = await new GroupFactory({
            organization,
            period,
            name: new TranslatedString(otherGroupName),
        }).create();

        // Only the first group sits in the granted category: the second one stays reachable
        // through the menu for a full admin, but must be invisible for narrower roles.
        const category = GroupCategory.create({
            settings: GroupCategorySettings.create({ name: `Takken ${label}` }),
            groupIds: [group.id],
        });
        const otherCategory = GroupCategory.create({
            settings: GroupCategorySettings.create({ name: `Andere takken ${label}` }),
            groupIds: [otherGroup.id],
        });

        organizationPeriod.settings.categories.push(category, otherCategory);
        organizationPeriod.settings.rootCategory?.categoryIds.push(category.id, otherCategory.id);
        await organizationPeriod.save();

        const memberName = `Lid-${label}`;
        const otherMemberName = `AnderLid-${label}`;

        const member = await new MemberFactory({ organization, firstName: memberName, lastName: 'Test' }).create();
        await new RegistrationFactory({ member, group }).create();

        const otherMember = await new MemberFactory({ organization, firstName: otherMemberName, lastName: 'Test' }).create();
        await new RegistrationFactory({ member: otherMember, group: otherGroup }).create();

        // An event belongs to the period that contains its start date
        const eventName = `Kamp ${label}`;
        const eventStart = new Date(period.startDate.getTime() + 24 * 60 * 60 * 1000);

        // Its registration group lives in the same period as the event
        const eventGroup = withEventRegistrations
            ? await new GroupFactory({
                organization,
                period,
                type: GroupType.EventRegistration,
                name: new TranslatedString(eventName),
            }).create()
            : undefined;

        const event = await new EventFactory({
            organization,
            name: eventName,
            group: eventGroup,
            startDate: eventStart,
            endDate: new Date(eventStart.getTime() + 24 * 60 * 60 * 1000),
        }).create();

        const eventMemberName = `Deelnemer-${label}`;

        if (eventGroup) {
            const eventMember = await new MemberFactory({ organization, firstName: eventMemberName, lastName: 'Test' }).create();
            await new RegistrationFactory({ member: eventMember, group: eventGroup }).create();
        }

        return {
            period,
            periodName,
            eventYear: eventStart.getFullYear(),
            categoryId: category.id,
            group,
            groupName,
            memberName,
            otherGroup,
            otherGroupName,
            otherMemberName,
            eventName,
            eventId: event.id,
            eventMemberName,
        };
    }

    async function seedScenario(seedId: string, options?: { withEventRegistrations?: boolean }): Promise<Scenario> {
        const runId = `${WorkerData.id}-${seedId}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

        const organization = await new OrganizationFactory({
            name: `Period Permissions Organization ${runId}`,
            uri: `period-permissions-${runId}`,
            packages: [STPackageBundle.Members],
        }).create();
        await STPackageService.updateOrganizationPackages(organization.id);

        const currentPeriodName = 'Huidig testwerkjaar';
        const previousPeriodName = 'Vorig testwerkjaar';

        // The events calendar only offers the current year and the two before it, so both
        // periods (and therefore both events) have to sit inside that window.
        const currentYear = new Date().getFullYear() - 1;
        const previousYear = currentYear - 1;

        const currentPeriod = await RegistrationPeriod.getByID(organization.periodId);
        if (!currentPeriod) {
            throw new Error('Missing registration period for organization');
        }
        currentPeriod.customName = currentPeriodName;
        currentPeriod.startDate = new Date(currentYear, 0, 1, 0, 0, 0, 0);
        currentPeriod.endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);
        await currentPeriod.save();

        const previousPeriod = await new RegistrationPeriodFactory({
            organization,
            startDate: new Date(previousYear, 0, 1, 0, 0, 0, 0),
            endDate: new Date(previousYear, 11, 31, 23, 59, 59, 999),
        }).create();
        previousPeriod.customName = previousPeriodName;
        await previousPeriod.save();

        const current = await seedPeriod({ organization, period: currentPeriod, periodName: currentPeriodName, label: `huidig-${runId}`, withEventRegistrations: options?.withEventRegistrations ?? false });
        const previous = await seedPeriod({ organization, period: previousPeriod, periodName: previousPeriodName, label: `vorig-${runId}`, withEventRegistrations: options?.withEventRegistrations ?? false });

        return { organization, current, previous };
    }

    async function createUser({ organization, permissions, seedId }: {
        organization: Organization;
        permissions: Permissions;
        seedId: string;
    }): Promise<User> {
        return await new UserFactory({
            firstName: 'Period',
            lastName: 'Permissions Admin',
            email: `period-permissions-${seedId}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@test.be`,
            organization,
            permissions,
        }).create();
    }

    async function openDashboard({ page, organization, user }: { page: Page; organization: Organization; user: User }) {
        const token = await SessionService.createSession(user);
        const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
        const organizationId = organization.id;

        await page.addInitScript(({ organizationId, tokenString }) => {
            window.localStorage.setItem('token-' + organizationId, tokenString);
        }, { organizationId, tokenString });

        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}`);
    }

    /** Opens the period switcher of the members menu */
    async function openPeriodSwitcher({ page }: { page: Page }) {
        await page.getByTestId('members-menu').locator('.footer button').first().click();
    }

    /** Switches the members menu to another period through the period switcher */
    async function switchToPeriod({ page, periodName }: { page: Page; periodName: string }) {
        await openPeriodSwitcher({ page });

        const item = page.getByTestId('context-menu-item-title').filter({ hasText: periodName });
        await expect(item).toBeVisible();
        await item.click();
    }

    /**
     * Opens a group from the menu and drills through its overview into the members table.
     * The overview itself already depends on the group's period: it decides there whether the
     * role has full permissions on the group.
     */
    async function openGroupMembers({ page, group }: { page: Page; group: Group }) {
        const menuItem = page.locator(`[id="${group.id}"]`);
        await expect(menuItem).toBeVisible();
        await menuItem.click();

        const membersItem = page.locator('.st-list-item', { hasText: 'Ingeschreven leden' }).first();
        await expect(membersItem).toBeVisible();
        await membersItem.click();

        const table = page.getByTestId('table');
        await expect(table).toBeVisible();
        return table;
    }

    /**
     * Executes a write action on the first row of the members table. The action is only offered
     * when canAccessGroup grants Write for the group's own period, which is what we are testing.
     */
    async function expectWriteAction({ page, memberName }: { page: Page; memberName: string }) {
        const table = page.getByTestId('table');
        const row = table.locator('[data-testid="table-row"]:visible').filter({ hasText: memberName });
        await expect(row).toHaveCount(1);

        await row.click({ button: 'right' });

        const action = page.getByTestId('context-menu-item-title').filter({ hasText: 'Gegevens bewerken' });
        await expect(action).toBeVisible();
        await action.click();

        // The edit view opens, which confirms the action really ran
        const editView = page.getByTestId('member-step');
        await expect(editView).toBeVisible();

        // Close it again: the popup would otherwise swallow clicks of the next step
        await page.keyboard.press('Escape');
        await expect(editView).toBeHidden();
    }

    async function expectNoWriteAction({ page, memberName }: { page: Page; memberName: string }) {
        const table = page.getByTestId('table');
        const row = table.locator('[data-testid="table-row"]:visible').filter({ hasText: memberName });
        await expect(row).toHaveCount(1);

        await row.click({ button: 'right' });

        await expect(page.getByTestId('context-menu-item-title').filter({ hasText: 'Gegevens bewerken' })).toHaveCount(0);
    }

    test('full access reaches groups of every period', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario('full');
        const user = await createUser({
            organization: scenario.organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
            seedId: 'full',
        });

        await page.setViewportSize({ width: 1280, height: 800 });
        await openDashboard({ page, organization: scenario.organization, user });

        await openGroupMembers({ page, group: scenario.current.group });
        await expectWriteAction({ page, memberName: scenario.current.memberName });
    });

    test('a $currentPeriod grant reaches the groups of the current period', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario('current-period');
        const user = await createUser({
            organization: scenario.organization,
            permissions: resourcePermissions(PermissionsResourceType.Groups, PermissionsResourceKey.CurrentPeriod),
            seedId: 'current-period',
        });

        await page.setViewportSize({ width: 1280, height: 800 });
        await openDashboard({ page, organization: scenario.organization, user });

        await openGroupMembers({ page, group: scenario.current.group });
        await expectWriteAction({ page, memberName: scenario.current.memberName });
    });

    test('a grant on one group of the current period reaches only that group', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario('one-group');
        const user = await createUser({
            organization: scenario.organization,
            permissions: resourcePermissions(PermissionsResourceType.Groups, scenario.current.group.id),
            seedId: 'one-group',
        });

        await page.setViewportSize({ width: 1280, height: 800 });
        await openDashboard({ page, organization: scenario.organization, user });

        await openGroupMembers({ page, group: scenario.current.group });
        await expectWriteAction({ page, memberName: scenario.current.memberName });

        // Negative case: the group outside the grant is not offered in the menu at all
        await expect(page.locator(`[id="${scenario.current.otherGroup.id}"]`)).toHaveCount(0);
    });

    test('a grant on one group of a previous period reaches that group', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario('previous-group');
        const user = await createUser({
            organization: scenario.organization,
            permissions: resourcePermissions(PermissionsResourceType.Groups, scenario.previous.group.id),
            seedId: 'previous-group',
        });

        await page.setViewportSize({ width: 1280, height: 800 });
        await openDashboard({ page, organization: scenario.organization, user });

        await switchToPeriod({ page, periodName: scenario.previous.periodName });
        await openGroupMembers({ page, group: scenario.previous.group });
        await expectWriteAction({ page, memberName: scenario.previous.memberName });
    });

    test('a category grant reaches the groups of that category in the current period', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario('current-category');
        const user = await createUser({
            organization: scenario.organization,
            permissions: resourcePermissions(PermissionsResourceType.GroupCategories, scenario.current.categoryId),
            seedId: 'current-category',
        });

        await page.setViewportSize({ width: 1280, height: 800 });
        await openDashboard({ page, organization: scenario.organization, user });

        await openGroupMembers({ page, group: scenario.current.group });
        await expectWriteAction({ page, memberName: scenario.current.memberName });

        await expect(page.locator(`[id="${scenario.current.otherGroup.id}"]`)).toHaveCount(0);
    });

    test('a category grant of a previous period reaches the groups of that category', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario('previous-category');
        const user = await createUser({
            organization: scenario.organization,
            permissions: resourcePermissions(PermissionsResourceType.GroupCategories, scenario.previous.categoryId),
            seedId: 'previous-category',
        });

        await page.setViewportSize({ width: 1280, height: 800 });
        await openDashboard({ page, organization: scenario.organization, user });

        await switchToPeriod({ page, periodName: scenario.previous.periodName });
        await openGroupMembers({ page, group: scenario.previous.group });

        // Categories are stored per period, so this only works when the frontend resolves them
        // in the group's own period instead of the organization's current one.
        await expectWriteAction({ page, memberName: scenario.previous.memberName });
    });
    /** Opens the calendar tab and selects the year the event of that period lives in */
    async function openCalendar({ page, year }: { page: Page; year: number }) {
        await page.getByTestId('tab-button').filter({ hasText: 'Activiteiten' }).click();
        await expect(page.locator('#settings-view')).toBeVisible();

        await page.locator('.scrollable-segmented-control button', { hasText: String(year) }).first().click();
    }

    function eventRow(page: Page, eventName: string) {
        return page.locator('#settings-view .st-list-item:visible h3 span').filter({
            hasText: new RegExp(`^${eventName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
        });
    }

    test('a grant on an event of the current period reaches that event', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario('current-event');
        const user = await createUser({
            organization: scenario.organization,
            permissions: resourcePermissions(PermissionsResourceType.Events, scenario.current.eventId),
            seedId: 'current-event',
        });

        await page.setViewportSize({ width: 1280, height: 800 });
        await openDashboard({ page, organization: scenario.organization, user });

        await openCalendar({ page, year: scenario.current.eventYear });
        await expect(eventRow(page, scenario.current.eventName)).toHaveCount(1);

        // Negative case: the event of the other period is not covered by this grant
        await openCalendar({ page, year: scenario.previous.eventYear });
        await expect(eventRow(page, scenario.previous.eventName)).toHaveCount(0);
    });

    test('a grant on an event of a previous period reaches that event', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario('previous-event');
        const user = await createUser({
            organization: scenario.organization,
            permissions: resourcePermissions(PermissionsResourceType.Events, scenario.previous.eventId),
            seedId: 'previous-event',
        });

        await page.setViewportSize({ width: 1280, height: 800 });
        await openDashboard({ page, organization: scenario.organization, user });

        // An explicit event grant is not period scoped, so it reaches a past period too
        await openCalendar({ page, year: scenario.previous.eventYear });
        await expect(eventRow(page, scenario.previous.eventName)).toHaveCount(1);

        await openCalendar({ page, year: scenario.current.eventYear });
        await expect(eventRow(page, scenario.current.eventName)).toHaveCount(0);
    });
    test('a $currentPeriod grant cannot open a previous period', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario('current-period-blocked');
        const user = await createUser({
            organization: scenario.organization,
            permissions: resourcePermissions(PermissionsResourceType.Groups, PermissionsResourceKey.CurrentPeriod),
            seedId: 'current-period-blocked',
        });

        await page.setViewportSize({ width: 1280, height: 800 });
        await openDashboard({ page, organization: scenario.organization, user });

        await openPeriodSwitcher({ page });

        // $currentPeriod is stripped outside the current period, leaving this role without any
        // grant there, so the period is offered but refused with a reason.
        await expect(page.getByTestId('context-menu-item-title').filter({ hasText: scenario.previous.periodName })).toBeVisible();
        await expect(page.locator('.disabled').filter({ hasText: scenario.previous.periodName }).first()).toBeVisible();
    });

    test('an $all grant reaches the groups of every period', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario('all-groups');
        const user = await createUser({
            organization: scenario.organization,
            permissions: resourcePermissions(PermissionsResourceType.Groups, PermissionsResourceKey.All),
            seedId: 'all-groups',
        });

        await page.setViewportSize({ width: 1280, height: 800 });
        await openDashboard({ page, organization: scenario.organization, user });

        await openGroupMembers({ page, group: scenario.current.group });
        await expectWriteAction({ page, memberName: scenario.current.memberName });

        // Unlike $currentPeriod, $all survives the period scoping
        await switchToPeriod({ page, periodName: scenario.previous.periodName });
        await openGroupMembers({ page, group: scenario.previous.group });
        await expectWriteAction({ page, memberName: scenario.previous.memberName });
    });

    test('a $currentPeriod grant on events reaches only the events of the current period', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario('current-period-events');
        const user = await createUser({
            organization: scenario.organization,
            permissions: resourcePermissions(PermissionsResourceType.Events, PermissionsResourceKey.CurrentPeriod),
            seedId: 'current-period-events',
        });

        await page.setViewportSize({ width: 1280, height: 800 });
        await openDashboard({ page, organization: scenario.organization, user });

        await openCalendar({ page, year: scenario.current.eventYear });
        await expect(eventRow(page, scenario.current.eventName)).toHaveCount(1);

        await openCalendar({ page, year: scenario.previous.eventYear });
        await expect(eventRow(page, scenario.previous.eventName)).toHaveCount(0);
    });
    test('a grant on an event of a previous period can read its registrations', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario('previous-event-registrations', { withEventRegistrations: true });
        const user = await createUser({
            organization: scenario.organization,
            permissions: resourcePermissions(PermissionsResourceType.Events, scenario.previous.eventId),
            seedId: 'previous-event-registrations',
        });

        await page.setViewportSize({ width: 1280, height: 800 });
        await openDashboard({ page, organization: scenario.organization, user });

        await openCalendar({ page, year: scenario.previous.eventYear });
        await eventRow(page, scenario.previous.eventName).click();

        // The registrations of the event itself, not the default members list
        const registrationsItem = page.locator('.st-list-item', { hasText: 'Ingeschreven leden' }).first();
        await expect(registrationsItem).toBeVisible();
        await registrationsItem.click();

        const table = page.getByTestId('table');
        await expect(table).toBeVisible();
        await expect(table.locator('[data-testid="table-row"]:visible').filter({ hasText: scenario.previous.eventMemberName })).toHaveCount(1);
    });
});
