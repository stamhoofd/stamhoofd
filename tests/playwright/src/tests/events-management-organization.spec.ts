// test should always be imported first
import { test, setup } from '../test-fixtures/base.js';
setup();

// other imports
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Organization, User } from '@stamhoofd/models';
import {
    EventFactory,
    GroupFactory,
    OrganizationFactory,
    RegistrationPeriodFactory,
    Token,
    UserFactory,
} from '@stamhoofd/models';
import {
    EventMeta,
    GroupType,
    PermissionLevel,
    Permissions,
} from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { DashboardTab, WorkerData } from '../helpers/index.js';
import type { Pages } from '../helpers/index.js';

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

function eventRow(page: Page, eventName: string) {
    return page.locator('#settings-view .st-list-item:visible h3 span').filter({
        hasText: new RegExp(`^${escapeRegExp(eventName)}$`),
    });
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

test.describe('Duplicate event', () => {
    const password = 'testAbc123456';

    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    type DuplicateScenario = {
        organizationUri: string;
        email: string;
        password: string;
        eventName: string;
        previousYear: number;
    };

    async function seedLockedPeriodScenario(options: {
        seedId: string;
    }): Promise<DuplicateScenario> {
        TestUtils.setPermanentEnvironment('userMode', 'platform');

        const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
        const runId = `${WorkerData.id}-${options.seedId}-${uniqueId}`;
        const organizationUri = `duplicate-event-organization-${runId}`;
        const email = `duplicate-event-${runId}@test.be`;
        const previousYear = new Date().getFullYear() - 1;

        const organization: Organization = await new OrganizationFactory({
            name: `Duplicate Event Organization ${runId}`,
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

        // A locked registration period in the past. The event and its registration group live
        // in this period, so the registration group cannot be copied when the event is
        // duplicated (creating a group in a locked period is refused by the backend).
        const lockedPeriod = await new RegistrationPeriodFactory({
            startDate: new Date(previousYear, 0, 1),
            endDate: new Date(previousYear, 11, 31),
            locked: true,
        }).create();

        const group = await new GroupFactory({
            organization,
            period: lockedPeriod,
            type: GroupType.EventRegistration,
        }).create();

        const eventName = `Locked period event ${runId}`;

        await new EventFactory({
            organization,
            name: eventName,
            startDate: new Date(previousYear, 5, 10, 10, 0, 0),
            endDate: new Date(previousYear, 5, 10, 12, 0, 0),
            meta: EventMeta.create({ visible: true }),
            group,
        }).create();

        return { organizationUri, email, password, eventName, previousYear };
    }

    function yearButton(page: Page, year: number) {
        return page.locator('#settings-view .scrollable-segmented-control button.item').filter({
            hasText: new RegExp(`^${year}$`),
        });
    }

    async function duplicateEventUntilWarning(options: {
        page: Page;
        pages: Pages;
        scenario: DuplicateScenario;
        duplicateName: string;
    }) {
        const { page, pages, scenario } = options;

        await pages.dashboard.login({
            organizationUri: scenario.organizationUri,
            email: scenario.email,
            password: scenario.password,
        });

        await pages.dashboard.openTab(DashboardTab.Events);
        await expect(page.locator('#settings-view')).toBeVisible();

        // Events in the past are only visible when their year is selected
        await yearButton(page, scenario.previousYear).click();
        await eventRow(page, scenario.eventName).click();

        // Open the duplicate popup from the event overview
        await page.locator('.st-list-item:visible').filter({ hasText: 'Activiteit dupliceren' }).click();

        const popup = page.locator('div.popup.focused').last();
        await expect(popup.getByTestId('save-view')).toBeVisible();

        // Give the copy a different name so the assertions can tell both events apart
        await popup.locator('input[placeholder="Naam"]').first().fill(options.duplicateName);
        await popup.getByTestId('save-button').click();

        // The registration group cannot be created in the locked period: a warning should
        // appear where the user can choose to continue without the group or cancel
        const dialog = page.getByTestId('centered-message');
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText('Inschrijvingsinstellingen kunnen niet mee gekopieerd worden');
        return dialog;
    }

    test('duplicating an event from a locked period warns and can continue without the registration group', async ({
        page,
        pages,
    }) => {
        const scenario = await seedLockedPeriodScenario({
            seedId: 'duplicate-continue',
        });
        const duplicateName = `${scenario.eventName} copy`;

        const dialog = await duplicateEventUntilWarning({ page, pages, scenario, duplicateName });

        await page.getByTestId('centered-message-button').filter({ hasText: 'Dupliceren zonder inschrijvingen' }).click();
        await expect(dialog).toHaveCount(0);

        // The duplicated event is kept and opened, but without registration settings
        await expect(page.locator('.st-view:visible h1').filter({ hasText: duplicateName }).first()).toBeVisible();
        await expect(page.locator('.st-list-item:visible h2').filter({ hasText: 'Ingeschreven leden' })).toHaveCount(0);
    });

    test('duplicating an event from a locked period deletes the event again on cancel', async ({
        page,
        pages,
    }) => {
        const scenario = await seedLockedPeriodScenario({
            seedId: 'duplicate-cancel',
        });
        const duplicateName = `${scenario.eventName} copy`;

        const dialog = await duplicateEventUntilWarning({ page, pages, scenario, duplicateName });

        await page.getByTestId('centered-message-button').filter({ hasText: 'Duplicatie annuleren' }).click();
        await expect(dialog).toHaveCount(0);

        // The duplicated event was deleted again: only the original event remains.
        // Navigate back from the event overview to the events list.
        await page.locator('[data-testid="close-button"]:visible').click();
        await expect(page.locator('#settings-view')).toBeVisible();
        await yearButton(page, scenario.previousYear).click();

        await expect(eventRow(page, scenario.eventName)).toHaveCount(1);
        await expect(eventRow(page, duplicateName)).toHaveCount(0);
    });
});
