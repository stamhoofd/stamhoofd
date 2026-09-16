// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { Organization } from '@stamhoofd/models';
import {
    EventFactory,
    GroupFactory,
    OrganizationFactory,
    OrganizationRegistrationPeriodFactory,
    PlatformEventTypeFactory,
    RegistrationPeriod,
    RegistrationPeriodFactory,
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
        inStartedPeriod: string;
        inNotStartedPeriod: string;
        withRegistrations: string;
    };
    /** A date inside the period the organization never started */
    notStartedDate: Date;
};

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function eventRow(page: Page, eventName: string) {
    return page.locator('#settings-view .st-list-item:visible h3 span').filter({
        hasText: new RegExp(`^${escapeRegExp(eventName)}$`),
    });
}

function actionRow(page: Page, label: string) {
    return page.locator('.st-list-item:visible h2').filter({
        hasText: new RegExp(`^${escapeRegExp(label)}$`),
    });
}

function daysFromNow(days: number, hours = 10) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hours, 0, 0, 0);
    return date;
}

/**
 * Focusing a date input opens a calendar overlay, so the inputs are scoped to the edit view itself
 * instead of to the last opened popup. The model is only written once the inputs lose focus.
 */
async function setStartDate(editView: Locator, date: Date) {
    const inputs = editView.locator('.date-selection-container').first().locator('input');

    await inputs.nth(0).fill(String(date.getDate()).padStart(2, '0'));
    await inputs.nth(1).fill(String(date.getMonth() + 1).padStart(2, '0'));
    await inputs.nth(2).fill(String(date.getFullYear()));
    await inputs.nth(2).evaluate((element: HTMLInputElement) => element.blur());
}

/**
 * The database reset between tests only deletes registration periods that belong to an organization,
 * so the global periods seeded here survive into the next run. Two periods covering the same date
 * make the period lookup by date ambiguous, so earlier copies are removed before seeding new ones.
 */
const startedPeriodName = 'E2E gestart werkjaar';
const notStartedPeriodName = 'E2E niet gestart werkjaar';

// Tagged @extra so it is excluded from the default (CI) run. Run it with: yarn stam test e2e --extra
test.describe('Event registration period @event-registration-period @extra', () => {
    const password = 'testAbc123456';

    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    async function seedScenario(seedId: string): Promise<Scenario> {
        TestUtils.setPermanentEnvironment('userMode', 'platform');

        const runId = `${WorkerData.id}-${seedId}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
        const organizationUri = `event-period-organization-${runId}`;
        const email = `event-period-${runId}@test.be`;

        // The period the organization is in, and did start
        const startedPeriod = await new RegistrationPeriodFactory({
            startDate: daysFromNow(-180, 0),
            endDate: daysFromNow(180, 23),
        }).create();

        // The next period: it exists, but this organization never started it, so it has no
        // OrganizationRegistrationPeriod
        const notStartedPeriod = await new RegistrationPeriodFactory({
            startDate: daysFromNow(181, 0),
            endDate: daysFromNow(540, 23),
        }).create();

        const organization: Organization = await new OrganizationFactory({
            name: `Event Period Organization ${runId}`,
            uri: organizationUri,
            period: startedPeriod,
        }).create();

        await new OrganizationRegistrationPeriodFactory({
            organization,
            period: startedPeriod,
        }).create();

        const typeId = (await new PlatformEventTypeFactory({}).create()).id;

        // Only the periods left behind by earlier runs carry these names: the new ones are named
        // after the cleanup
        await RegistrationPeriod.delete().where('customName', [startedPeriodName, notStartedPeriodName]);

        startedPeriod.customName = startedPeriodName;
        await startedPeriod.save();
        notStartedPeriod.customName = notStartedPeriodName;
        await notStartedPeriod.save();

        await new UserFactory({
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

        const names = {
            inStartedPeriod: `Started period event ${runId}`,
            inNotStartedPeriod: `Not started period event ${runId}`,
            withRegistrations: `Registrations event ${runId}`,
        };

        await new EventFactory({
            organization,
            name: names.inStartedPeriod,
            startDate: daysFromNow(30),
            endDate: daysFromNow(30, 12),
            typeId,
            meta: EventMeta.create({ visible: true }),
        }).create();

        await new EventFactory({
            organization,
            name: names.inNotStartedPeriod,
            startDate: daysFromNow(300),
            endDate: daysFromNow(300, 12),
            typeId,
            meta: EventMeta.create({ visible: true }),
        }).create();

        // An activity that already collects registrations, inside the period that was started
        const group = await new GroupFactory({
            organization,
            period: startedPeriod,
            type: GroupType.EventRegistration,
        }).create();

        await new EventFactory({
            organization,
            name: names.withRegistrations,
            startDate: daysFromNow(40),
            endDate: daysFromNow(40, 12),
            typeId,
            group,
            meta: EventMeta.create({ visible: true }),
        }).create();

        return {
            organizationUri,
            email,
            password,
            names,
            notStartedDate: daysFromNow(300),
        };
    }

    async function openEvent(options: {
        page: Page;
        pages: Pages;
        scenario: Scenario;
        eventName: string;
    }) {
        const { page, pages, scenario } = options;

        await pages.dashboard.login({
            organizationUri: scenario.organizationUri,
            email: scenario.email,
            password: scenario.password,
        });

        await pages.dashboard.openTab(DashboardTab.Events);
        await expect(page.locator('#settings-view')).toBeVisible();

        // Future events are listed without selecting a year
        await eventRow(page, options.eventName).click();
    }

    test('activates registrations for an activity in a period the organization started', async ({ page, pages }) => {
        const scenario = await seedScenario('happy-path');

        await openEvent({ page, pages, scenario, eventName: scenario.names.inStartedPeriod });

        await actionRow(page, 'Inschrijvingen activeren via het ledenportaal (enkel voor leden)').click();

        const dialog = page.getByTestId('centered-message');
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText('Inschrijvingen verzamelen voor deze activiteit?');

        await page.getByTestId('centered-message-button').filter({ hasText: 'Inschrijvingen activeren' }).click();
        await expect(dialog).toHaveCount(0);

        // The registration group was created, so its settings and registrations become available
        await expect(actionRow(page, 'Inschrijvingsinstellingen')).toBeVisible();
        await expect(actionRow(page, 'Ingeschreven leden')).toBeVisible();
    });

    test('refuses to activate registrations for an activity in a period the organization did not start', async ({ page, pages }) => {
        const scenario = await seedScenario('not-started');

        await openEvent({ page, pages, scenario, eventName: scenario.names.inNotStartedPeriod });

        await actionRow(page, 'Inschrijvingen activeren via het ledenportaal (enkel voor leden)').click();

        await expect(page.getByTestId('toast-box')).toContainText('nog niet gestart met het werkjaar');

        // The confirmation is pointless here, so it is never shown
        await expect(page.getByTestId('centered-message')).toHaveCount(0);

        // And no registration group was created
        await expect(actionRow(page, 'Inschrijvingsinstellingen')).toHaveCount(0);
    });

    test('warns and refuses when moving an activity with registrations into a period the organization did not start', async ({ page, pages }) => {
        const scenario = await seedScenario('move-period');

        await openEvent({ page, pages, scenario, eventName: scenario.names.withRegistrations });

        await actionRow(page, 'Algemeen').click();

        const editView = page.getByTestId('save-view');
        await expect(editView).toBeVisible();

        // The current date is inside the period the organization started: no warning yet
        await expect(editView.locator('.warning-box')).toHaveCount(0);

        await setStartDate(editView, scenario.notStartedDate);

        // The frontend warns before saving
        await expect(editView.locator('.warning-box')).toContainText('pas naar dat werkjaar verplaatsen');

        // And saving anyway is refused by the backend
        await editView.getByTestId('save-button').click();
        await expect(editView.getByTestId('input-error')).toContainText('daarom kan je hier geen inschrijvingen in aanmaken');
    });
});
