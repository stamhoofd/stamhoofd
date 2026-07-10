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
    names: {
        // Belongs to the organization, registered in the current period
        currentPeriod: string;
        // Belongs to the organization, registered only in a previous period
        previousPeriod: string;
        // Belongs to the organization, but has no registrations in any group/period
        withoutRegistrations: string;
        // Belongs to a different organization, should never show up
        otherOrganization: string;
    };
};

test.describe('All members list (organization mode) @all-members', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    async function seedScenario(seedId: string): Promise<Scenario> {
        const runId = `${WorkerData.id}-${seedId}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

        const organization = await new OrganizationFactory({
            name: `All Members Organization ${runId}`,
            uri: `all-members-organization-${runId}`,
            packages: [STPackageBundle.Members],
        }).create();
        await STPackageService.updateOrganizationPackages(organization.id);

        const currentPeriod = await RegistrationPeriod.getByID(organization.periodId);
        if (!currentPeriod) {
            throw new Error('Missing registration period for organization');
        }

        const organizationPeriod = await new OrganizationRegistrationPeriodFactory({
            organization,
            period: currentPeriod,
        }).create();

        const currentGroup = await new GroupFactory({
            organization,
            period: currentPeriod,
            name: new TranslatedString('Kapoenen'),
        }).create();

        // The group must be part of a category to show up in the period groups
        const category = GroupCategory.create({
            settings: GroupCategorySettings.create({ name: 'Takken' }),
            groupIds: [currentGroup.id],
        });
        organizationPeriod.settings.categories.push(category);
        organizationPeriod.settings.rootCategory?.categoryIds.push(category.id);
        await organizationPeriod.save();

        // A previous period (of the same organization) with its own group
        const previousPeriod: RegistrationPeriod = await new RegistrationPeriodFactory({
            organization,
            startDate: new Date(2020, 0, 1, 0, 0, 0, 0),
            endDate: new Date(2020, 11, 31, 23, 59, 59, 999),
        }).create();
        const previousGroup = await new GroupFactory({
            organization,
            period: previousPeriod,
            name: new TranslatedString('Oude tak'),
        }).create();

        // A completely separate organization with its own member
        const otherOrganization = await new OrganizationFactory({
            name: `Other Organization ${runId}`,
            uri: `other-organization-${runId}`,
        }).create();
        const otherOrganizationGroup = await new GroupFactory({
            organization: otherOrganization,
            name: new TranslatedString('Andere tak'),
        }).create();

        const names = {
            currentPeriod: `Huidige-${runId}`,
            previousPeriod: `Vorige-${runId}`,
            withoutRegistrations: `Zonder-${runId}`,
            otherOrganization: `Andere-${runId}`,
        };

        // Member registered in the current period
        const currentMember = await new MemberFactory({
            organization,
            firstName: names.currentPeriod,
            lastName: 'Lid',
        }).create();
        await new RegistrationFactory({ member: currentMember, group: currentGroup }).create();

        // Member only registered in a previous period
        const previousMember = await new MemberFactory({
            organization,
            firstName: names.previousPeriod,
            lastName: 'Lid',
        }).create();
        await new RegistrationFactory({ member: previousMember, group: previousGroup }).create();

        // Member of the organization without any registration in any group/period
        await new MemberFactory({
            organization,
            firstName: names.withoutRegistrations,
            lastName: 'Lid',
        }).create();

        // Member of a different organization (must never show up)
        const otherMember = await new MemberFactory({
            organization: otherOrganization,
            firstName: names.otherOrganization,
            lastName: 'Lid',
        }).create();
        await new RegistrationFactory({ member: otherMember, group: otherOrganizationGroup }).create();

        const user = await new UserFactory({
            firstName: 'All',
            lastName: 'Members Admin',
            email: `all-members-admin-${runId}@test.be`,
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();

        return { organization, user, names };
    }

    async function loginAs({ page, user }: { page: Page; user: User }) {
        const token = await Token.createToken(user);
        const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));

        const organizationId = user.organizationId;
        await page.addInitScript(({ organizationId, tokenString }) => {
            window.localStorage.setItem('token-' + organizationId, tokenString);
        }, { organizationId, tokenString });
    }

    async function openAllMembersList({ page, scenario }: { page: Page; scenario: Scenario }) {
        await loginAs({ page, user: scenario.user });
        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${scenario.organization.uri}`);

        // The members menu (master pane) is the default view in organization mode
        const membersMenu = page.getByTestId('members-menu');
        await expect(membersMenu).toBeVisible();

        // The new action is hidden behind 'Meer' by default
        await membersMenu.locator('button.menu-button', { hasText: 'Meer' }).click();

        const item = page.getByTestId('context-menu-item-title').filter({ hasText: 'Alle leden (alle werkjaren)' });
        await expect(item).toBeVisible();
        await item.click();
    }

    test('lists every member of the organization across all periods, and excludes members of other organizations', async ({ page }) => {
        test.setTimeout(90_000);
        const scenario = await seedScenario('happy');
        const { names } = scenario;

        await openAllMembersList({ page, scenario });

        const table = page.getByTestId('table');
        await expect(table).toBeVisible();

        // The table virtualizes rows and keeps freed rows hidden in the DOM pool,
        // so we only ever look at the rows that are actually visible.
        const visibleRows = table.locator('[data-testid="table-row"]:visible');
        await visibleRows.first().waitFor();

        // The header shows the total member count. As there is no extra filter, this equals
        // the number of members of the organization (across all periods): exactly 3.
        // Waiting for it also guarantees the data has loaded and the virtual row list has
        // collapsed to the real rows before we start counting them.
        await expect(page.locator('.title-suffix')).toHaveText('3');

        const row = (name: string) => visibleRows.filter({ hasText: name });

        // Members that belong to the organization are all listed, regardless of period or registration
        await expect(row(names.currentPeriod)).toHaveCount(1);
        await expect(row(names.previousPeriod)).toHaveCount(1);
        await expect(row(names.withoutRegistrations)).toHaveCount(1);

        // Members of another organization are never listed
        await expect(row(names.otherOrganization)).toHaveCount(0);

        // Only the three organization members are shown (no extra filters)
        await expect(visibleRows).toHaveCount(3);
    });
});
