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
    RegistrationPeriodFactory,
} from '@stamhoofd/models';
import { EventMeta, TranslatedString } from '@stamhoofd/structures';
import type { Pages } from '../helpers/index.js';
import { WorkerData } from '../helpers/index.js';

/**
 * ChooseGroupForMemberView improvements (STA-1311 + STA-1266):
 * - the group list becomes searchable once there are more than five groups
 * - an 'Activiteiten' tab lets you register the member for an event directly
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
        await WorkerData.databaseHelper.clearGroups();
    });

    /**
     * Open the member portal, start registering the given member and pick the
     * organization, leaving the browser on ChooseGroupForMemberView.
     */
    async function openChooseGroup(page: Page, pages: Pages, memberName: string) {
        await pages.memberPortal.goto();

        await page.getByTestId('register-member-button').click();
        await page
            .getByTestId('member-button')
            .filter({ hasText: memberName })
            .click();

        const organizationSearch = page.getByTestId('organization-search-input');
        await organizationSearch.click();
        await organizationSearch.fill(organizationName);
        await page
            .getByTestId('organization-button')
            .filter({ hasText: organizationName })
            .click();
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
            const group = await new GroupFactory({
                organization,
                price: 0,
                name: new TranslatedString(name),
            }).create();

            // Keep registration open well into the future so the member can register
            group.settings.registrationEndDate = new Date(
                Date.now() + 24 * 60 * 60 * 1000,
            );
            await group.save();

            organizationPeriod.settings.rootCategory?.groupIds.push(group.id);
        }
        await organizationPeriod.save();

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
        const membershipGroup = await new GroupFactory({
            organization,
            price: 0,
            name: new TranslatedString('Kapoenen'),
        }).create();
        membershipGroup.settings.registrationEndDate = new Date(
            Date.now() + 24 * 60 * 60 * 1000,
        );
        await membershipGroup.save();
        organizationPeriod.settings.rootCategory?.groupIds.push(membershipGroup.id);
        await organizationPeriod.save();

        // An upcoming, visible event with a registration group. Creating the event
        // also registers a platform event type, which enables the activities tab.
        const eventGroup = await new GroupFactory({ organization, price: 0 }).create();
        const startDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
        const eventName = `Zomerkamp ${WorkerData.id}-${Math.floor(Math.random() * 1_000_000)}`;

        await new EventFactory({
            organization,
            group: eventGroup,
            name: eventName,
            startDate,
            endDate,
            meta: EventMeta.create({ visible: true, minAge: 0, maxAge: 99 }),
        }).create();

        await new MemberFactory({
            firstName: 'Jane',
            lastName: 'Doe',
            user,
        }).create();

        await openChooseGroup(page, pages, 'Jane Doe');

        // The tab bar is shown and the groups tab is active by default
        const tabs = page.getByTestId('register-tabs');
        await expect(tabs).toBeVisible();
        await expect(page.getByTestId('group-button')).toHaveCount(1);
        await expect(page.getByTestId('event-button')).toHaveCount(0);

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
});
