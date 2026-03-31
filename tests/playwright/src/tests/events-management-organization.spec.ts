// test should always be imported first
import { test } from '../test-fixtures/base.js';

// other imports
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Organization, User } from '@stamhoofd/models';
import {
    EventFactory,
    GroupFactory,
    OrganizationFactory,
    Token,
    UserFactory,
} from '@stamhoofd/models';
import {
    EventMeta,
    PermissionLevel,
    Permissions,
} from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { type Pages, DashboardTab, WorkerData } from '../helpers/index.js';

type Scenario = {
    organizationUri: string;
    email: string;
    password: string;
    names: {
        visibleNationalA: string;
        visibleNationalB: string;
        invisibleNationalNoGroup: string;
        invisibleNationalMatchingGroup: string;
        invisibleNationalNonMatchingGroup: string;
        invisibleOrganization: string;
    };
};

test.describe('Events management', () => {
    const password = 'testAbc123456';

    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    async function seedScenario(options: {
        seedId: string;
    }): Promise<Scenario> {
        TestUtils.setPermanentEnvironment('userMode', 'platform');

        const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
        const runId = `${WorkerData.id}-${options.seedId}-${uniqueId}`;
        const eventNameId = `${WorkerData.id}-${options.seedId}-${Math.floor(Math.random() * 10_000)}`;
        const organizationName = `Events Organization ${runId}`;
        const organizationUri = `events-organization-${runId}`;
        const email = `events-${runId}@test.be`;

        const names = {
            visibleNationalA: `Visible national event A ${eventNameId}`,
            visibleNationalB: `Visible national event B ${eventNameId}`,
            invisibleNationalNoGroup: `Invisible national no group ${eventNameId}`,
            invisibleNationalMatchingGroup: `Invisible national matching group ${eventNameId}`,
            invisibleNationalNonMatchingGroup: `Invisible national non matching group ${eventNameId}`,
            invisibleOrganization: `Invisible own event ${eventNameId}`,
        };

        const organization: Organization = await new OrganizationFactory({
            name: organizationName,
            uri: organizationUri,
        }).create();

        const user: User = await new UserFactory({
            firstName: 'John',
            lastName: 'Doe',
            email,
            password,
            organization,
            globalPermissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();

        await Token.createToken(user);

        const nonMatchingOrganization = await new OrganizationFactory({
            name: `Non matching organization ${runId}`,
            uri: `non-matching-organization-${runId}`,
        }).create();

        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 1);
        startDate.setHours(10, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setHours(12, 0, 0, 0);

        const visibleNationalAGroup = await new GroupFactory({
            organization,
        }).create();
        const visibleNationalBGroup = await new GroupFactory({
            organization,
        }).create();
        const invisibleNationalMatchingGroup = await new GroupFactory({
            organization,
        }).create();
        const invisibleNationalNonMatchingGroup = await new GroupFactory({
            organization: nonMatchingOrganization,
        }).create();

        await new EventFactory({
            group: visibleNationalAGroup,
            name: names.visibleNationalA,
            startDate,
            endDate,
            meta: EventMeta.create({ visible: true }),
        }).create();

        await new EventFactory({
            group: visibleNationalBGroup,
            name: names.visibleNationalB,
            startDate,
            endDate,
            meta: EventMeta.create({ visible: true }),
        }).create();

        await new EventFactory({
            name: names.invisibleNationalNoGroup,
            startDate,
            endDate,
            meta: EventMeta.create({ visible: false }),
        }).create();

        await new EventFactory({
            group: invisibleNationalMatchingGroup,
            name: names.invisibleNationalMatchingGroup,
            startDate,
            endDate,
            meta: EventMeta.create({ visible: false }),
        }).create();

        await new EventFactory({
            group: invisibleNationalNonMatchingGroup,
            name: names.invisibleNationalNonMatchingGroup,
            startDate,
            endDate,
            meta: EventMeta.create({ visible: false }),
        }).create();

        await new EventFactory({
            organization,
            name: names.invisibleOrganization,
            startDate,
            endDate,
            meta: EventMeta.create({ visible: false }),
        }).create();

        return {
            organizationUri,
            email,
            password,
            names,
        };
    }

    async function loginAndOpenEventsTab(options: {
        page: Page;
        pages: Pages;
        scenario: Scenario;
    }) {
        await options.pages.dashboard.login({
            organizationUri: options.scenario.organizationUri,
            email: options.scenario.email,
            password: options.scenario.password,
        });

        await options.pages.dashboard.openTab(DashboardTab.Events);
        await expect(options.page.locator('#settings-view')).toBeVisible();
    }

    function eventRow(page: Page, eventName: string) {
        return page.locator('#settings-view .st-list-item:visible h3 span').filter({
            hasText: new RegExp(`^${escapeRegExp(eventName)}$`),
        });
    }

    function escapeRegExp(value: string) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    async function assertScenarioVisibility(options: {
        page: Page;
        scenario: Scenario;
    }) {
        await expect(eventRow(options.page, options.scenario.names.invisibleNationalNoGroup)).toHaveCount(0);
        await expect(eventRow(options.page, options.scenario.names.invisibleNationalMatchingGroup)).toHaveCount(1);
        await expect(eventRow(options.page, options.scenario.names.invisibleNationalNonMatchingGroup)).toHaveCount(0);
        await expect(eventRow(options.page, options.scenario.names.invisibleOrganization)).toHaveCount(1);

        await expect(eventRow(options.page, options.scenario.names.visibleNationalA)).toHaveCount(1);
        await expect(eventRow(options.page, options.scenario.names.visibleNationalB)).toHaveCount(1);
    }

    test('shows invisible national events only when group organization matches dashboard organization', async ({
        page,
        pages,
    }) => {
        const scenario = await seedScenario({
            seedId: 'invisible',
        });

        await loginAndOpenEventsTab({ page, pages, scenario });
        await assertScenarioVisibility({
            page,
            scenario,
        });
    });
});
