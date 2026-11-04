// test should always be imported first
import { setup, test } from '../test-fixtures/platform.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type {
    Organization,
    OrganizationRegistrationPeriod,
    RegistrationPeriod,
    User,
} from '@stamhoofd/models';
import {
    EventFactory,
    GroupFactory,
    MemberFactory,
    OrganizationFactory,
    OrganizationRegistrationPeriodFactory,
    RegistrationFactory,
    RegistrationPeriodFactory,
} from '@stamhoofd/models';
import { EventMeta, TranslatedString } from '@stamhoofd/structures';
import type { Pages } from '../helpers/index.js';
import { WorkerData } from '../helpers/index.js';

/**
 * ChooseGroupForMemberView improvements (STA-1311 + STA-1266):
 * - the group list becomes searchable once there are more than five groups
 * - an 'Activiteiten' tab lets you register the member for an event directly
 * - organizations without groups open on the 'Activiteiten' tab (STA-1589)
 */
test.describe('Register member - choose group', () => {
    let organization: Organization;
    let period: RegistrationPeriod;
    let user: User;
    let organizationPeriod: OrganizationRegistrationPeriod;
    let organizationName: string;

    test.beforeAll(async () => {
        user = WorkerData.user;
        organization = await new OrganizationFactory({}).create();
        organizationName = organization.name;

        period = await new RegistrationPeriodFactory({
            startDate: new Date('2000-01-01'),
            endDate: new Date('2001-01-01'),
            organization,
        }).create();

        organization.periodId = period.id;
        await organization.save();

        organizationPeriod = await new OrganizationRegistrationPeriodFactory({
            period,
            organization,
        }).create();
    });

    test.afterEach(async () => {
        await WorkerData.databaseHelper.clearRegistrations();
        await WorkerData.databaseHelper.clearMembers();
        await WorkerData.databaseHelper.clearEvents();
        await WorkerData.databaseHelper.clearGroups();
    });

    const eventsRequestUrl = /\/events(?:\?|$)/;
    const DAY = 24 * 60 * 60 * 1000;

    /**
     * Create a group in the root category whose registration is open or already closed.
     */
    async function createGroup({ name, open }: { name: string; open: boolean }) {
        const group = await new GroupFactory({
            organization,
            price: 0,
            name: new TranslatedString(name),
        }).create();
        group.settings.registrationEndDate = new Date(Date.now() + (open ? DAY : -DAY));
        await group.save();

        organizationPeriod.settings.rootCategory?.groupIds.push(group.id);
        await organizationPeriod.save();
        return group;
    }

    /**
     * Create a visible event with a registration group, starting the given number of days
     * from now (negative for a past event). Also registers a platform event type, which
     * enables the activities tab. Returns the event name.
     */
    async function createEvent({ daysFromNow, name }: { daysFromNow: number; name?: string }) {
        const eventGroup = await new GroupFactory({ organization, price: 0 }).create();
        const startDate = new Date(Date.now() + daysFromNow * DAY);
        const eventName = name ?? `Kamp ${WorkerData.id}-${Math.floor(Math.random() * 1_000_000)}`;

        await new EventFactory({
            organization,
            group: eventGroup,
            name: eventName,
            startDate,
            endDate: new Date(startDate.getTime() + 2 * 60 * 60 * 1000),
            meta: EventMeta.create({ visible: true, minAge: 0, maxAge: 99 }),
        }).create();
        return eventName;
    }

    /**
     * Count the events requests made from now on.
     */
    function trackEventsRequests(page: Page) {
        let count = 0;
        page.on('request', (request) => {
            if (eventsRequestUrl.test(request.url())) {
                count++;
            }
        });
        return () => count;
    }

    /**
     * Open the member portal and start registering the given member. For a member
     * that is not linked to an organization yet, this shows the organization search.
     */
    async function startRegistering(page: Page, pages: Pages, memberName: string) {
        await pages.memberPortal.goto();

        await page.getByTestId('register-member-button').click();
        await page
            .getByTestId('member-button')
            .filter({ hasText: memberName })
            .click();
    }

    async function selectOrganization(page: Page) {
        const organizationSearch = page.getByTestId('organization-search-input');
        await organizationSearch.click();
        await organizationSearch.fill(organizationName);
        await page
            .getByTestId('organization-button')
            .filter({ hasText: organizationName })
            .click();
    }

    /**
     * Open the member portal, start registering the given member and pick the
     * organization, leaving the browser on ChooseGroupForMemberView.
     */
    async function openChooseGroup(page: Page, pages: Pages, memberName: string) {
        await startRegistering(page, pages, memberName);
        await selectOrganization(page);
    }

    test('shows a search field that filters the group list when more than five groups are available', async ({
        page,
        pages,
    }) => {
        const groupNames = [
            'Kapoenen',
            'Welpen',
            'Jonggidsen',
            'Gidsen',
            'Jin',
            'Leiding',
        ];

        for (const name of groupNames) {
            await createGroup({ name, open: true });
        }

        await new MemberFactory({
            firstName: 'John',
            lastName: 'Doe',
            user,
        }).create();

        await openChooseGroup(page, pages, 'John Doe');

        // The full list of groups is shown
        const groupButtons = page.getByTestId('group-button');
        await expect(groupButtons).toHaveCount(groupNames.length);

        // A search field appears because there are more than five groups
        const searchInput = page.getByTestId('group-search-input');
        await expect(searchInput).toBeVisible();

        await test.step('typing a query narrows the list to matching groups', async () => {
            await searchInput.fill('Welpen');
            await expect(groupButtons).toHaveCount(1);
            await expect(groupButtons.first()).toContainText('Welpen');
        });

        await test.step('clearing the query restores the full list', async () => {
            await searchInput.fill('');
            await expect(groupButtons).toHaveCount(groupNames.length);
        });
    });

    test('offers an activities tab to register the member for an event', async ({
        page,
        pages,
    }) => {
        // A regular group so the "Groepen" tab is not empty
        await createGroup({ name: 'Kapoenen', open: true });

        const eventName = await createEvent({
            daysFromNow: 1,
            name: `Zomerkamp ${WorkerData.id}-${Math.floor(Math.random() * 1_000_000)}`,
        });

        await new MemberFactory({
            firstName: 'Jane',
            lastName: 'Doe',
            user,
        }).create();

        await startRegistering(page, pages, 'Jane Doe');
        const eventsRequests = trackEventsRequests(page);
        await selectOrganization(page);

        // The tab bar is shown and the groups tab is active by default
        const tabs = page.getByTestId('register-tabs');
        await expect(tabs).toBeVisible();
        await expect(page.getByTestId('group-button')).toHaveCount(1);
        await expect(page.getByTestId('event-button')).toHaveCount(0);

        // With open groups there is no need to check for activities
        expect(eventsRequests()).toBe(0);

        await test.step('the activities tab lists the relevant event', async () => {
            await tabs.getByText('Activiteiten').click();

            const eventButton = page
                .getByTestId('event-button')
                .filter({ hasText: eventName });
            await expect(eventButton).toBeVisible();
        });

        await test.step('the activities tab can be searched', async () => {
            const eventSearch = page.getByTestId('event-search-input');
            await eventSearch.fill('zzz-no-matching-event');
            await expect(page.getByTestId('event-button')).toHaveCount(0);

            await eventSearch.fill('Zomerkamp');
            await expect(
                page.getByTestId('event-button').filter({ hasText: eventName }),
            ).toBeVisible();
        });
    });

    test('opens on the activities tab when the organization has no groups', async ({
        page,
        pages,
    }) => {
        const eventName = await createEvent({ daysFromNow: 1 });

        await new MemberFactory({
            firstName: 'Jan',
            lastName: 'Peeters',
            user,
        }).create();

        await openChooseGroup(page, pages, 'Jan Peeters');

        await expect(page.getByTestId('register-tabs')).toBeVisible();
        await expect(
            page.getByTestId('event-button').filter({ hasText: eventName }),
        ).toBeVisible();
        await expect(page.getByTestId('group-button')).toHaveCount(0);
    });

    test('opens on the activities tab when all groups of the organization are closed', async ({
        page,
        pages,
    }) => {
        await createGroup({ name: 'Kapoenen', open: false });
        const eventName = await createEvent({ daysFromNow: 1 });

        await new MemberFactory({
            firstName: 'Piet',
            lastName: 'Janssens',
            user,
        }).create();

        await openChooseGroup(page, pages, 'Piet Janssens');

        await expect(page.getByTestId('register-tabs')).toBeVisible();
        await expect(
            page.getByTestId('event-button').filter({ hasText: eventName }),
        ).toBeVisible();
        await expect(page.getByTestId('group-button')).toHaveCount(0);
    });

    test('stays on the groups tab when there are no groups and no activities to register for', async ({
        page,
        pages,
    }) => {
        // A past event must not count as an activity to register for
        await createEvent({ daysFromNow: -7 });

        await new MemberFactory({
            firstName: 'An',
            lastName: 'Claes',
            user,
        }).create();

        // Only the check after picking the organization may fetch events, not the organization search
        await startRegistering(page, pages, 'An Claes');
        const eventsRequests = trackEventsRequests(page);
        await selectOrganization(page);

        await expect(page.getByTestId('register-tabs')).toBeVisible();
        await expect(page.getByText('kan je op dit moment niet inschrijven')).toBeVisible();
        await expect(page.getByTestId('event-search-input')).toHaveCount(0);
        await expect(page.getByTestId('group-button')).toHaveCount(0);
        expect(eventsRequests()).toBe(1);
    });

    test('falls back to the groups tab when the activities cannot be loaded', async ({
        page,
        pages,
    }) => {
        await createEvent({ daysFromNow: 1 });

        await new MemberFactory({
            firstName: 'Lies',
            lastName: 'Wouters',
            user,
        }).create();

        // Simulate a network error
        await page.route(eventsRequestUrl, route => route.abort('internetdisconnected'));

        await openChooseGroup(page, pages, 'Lies Wouters');

        await expect(page.getByTestId('register-tabs')).toBeVisible();
        await expect(page.getByText('kan je op dit moment niet inschrijven')).toBeVisible();
        await expect(page.getByTestId('event-search-input')).toHaveCount(0);
        await expect(page.getByTestId('group-button')).toHaveCount(0);
    });

    test('opens on the activities tab for a member already linked to an organization without open groups', async ({
        page,
        pages,
    }) => {
        // Registering the member in a closed group links them to the organization
        const closedGroup = await createGroup({ name: 'Kapoenen', open: false });
        const eventName = await createEvent({ daysFromNow: 1 });

        const member = await new MemberFactory({
            firstName: 'Tom',
            lastName: 'Maes',
            user,
        }).create();
        await new RegistrationFactory({ member, group: closedGroup }).create();

        // No organization search: the view opens directly on the linked organization
        await startRegistering(page, pages, 'Tom Maes');

        await expect(page.getByTestId('register-tabs')).toBeVisible();
        await expect(
            page.getByTestId('event-button').filter({ hasText: eventName }),
        ).toBeVisible();
        await expect(page.getByTestId('group-button')).toHaveCount(0);
    });

    test('keeps the tab the user picks while checking for activities', async ({
        page,
        pages,
    }) => {
        // No groups and only a past event: the check would fall back to the groups tab
        await createEvent({ daysFromNow: -7 });

        await new MemberFactory({
            firstName: 'Eva',
            lastName: 'Peeters',
            user,
        }).create();

        // Hold back the events requests until the user picked a tab
        let releaseEvents!: () => void;
        const eventsReleased = new Promise<void>((resolve) => {
            releaseEvents = resolve;
        });
        await page.route(eventsRequestUrl, async (route) => {
            await eventsReleased;
            await route.continue();
        });

        await openChooseGroup(page, pages, 'Eva Peeters');

        const tabs = page.getByTestId('register-tabs');
        await expect(tabs).toBeVisible();
        await tabs.getByText('Activiteiten').click();
        await expect(page.getByTestId('event-search-input')).toBeVisible();

        let eventsResponses = 0;
        page.on('response', (response) => {
            if (eventsRequestUrl.test(response.url())) {
                eventsResponses++;
            }
        });
        releaseEvents();

        // The empty check result (and the activities list) must not switch back to the groups tab
        await expect.poll(() => eventsResponses).toBe(2);
        await expect(page.getByTestId('event-search-input')).toBeVisible();
        await expect(page.getByText('kan je op dit moment niet inschrijven')).toHaveCount(0);
    });
});
