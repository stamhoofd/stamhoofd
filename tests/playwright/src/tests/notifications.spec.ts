// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { NotificationService } from '@stamhoofd/backend/services/NotificationService';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import type { Organization, User } from '@stamhoofd/models';
import { EventFactory, GroupFactory, OrganizationFactory, OrganizationRegistrationPeriodFactory, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import { Notification } from '@stamhoofd/models/models/Notification.js';
import { NotificationPreference } from '@stamhoofd/models/models/NotificationPreference.js';
import { NotificationRecipient } from '@stamhoofd/models/models/NotificationRecipient.js';
import { appToUri, GroupType, NamedObject, PermissionLevel, Permissions, STPackageBundle, Token as TokenStruct, TranslatedString, Version } from '@stamhoofd/structures';
import { NotificationChannel } from '@stamhoofd/structures/notifications/NotificationChannel.js';
import { NotificationType } from '@stamhoofd/structures/notifications/NotificationType.js';
import { RegistrationCreatedNotificationPayload } from '@stamhoofd/structures/notifications/RegistrationCreatedNotificationPayload.js';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await SessionService.createSession(user);
    const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));

    const organizationId = user.organizationId;
    await page.addInitScript(({ organizationId, tokenString }) => {
        if (organizationId) {
            window.localStorage.setItem('token-' + organizationId, tokenString);
        } else {
            window.localStorage.setItem('token-platform', tokenString);
        }
    }, { organizationId, tokenString });
}

async function createAdmin({ featureFlags }: { featureFlags: string[] }) {
    const organization = await new OrganizationFactory({
        packages: [STPackageBundle.Members],
    }).create();
    await STPackageService.updateOrganizationPackages(organization.id);
    organization.privateMeta.featureFlags = featureFlags;
    await organization.save();

    const admin = await new UserFactory({
        organization,
        email: `notifications-${Math.random().toString(36).slice(2)}@example.com`,
        permissions: Permissions.create({ level: PermissionLevel.Full }),
    }).create();

    return { organization, admin };
}

async function sendRegistrationNotification(organization: Organization, admin: User, name: string) {
    await NotificationService.send({
        type: NotificationType.RegistrationCreated,
        payload: RegistrationCreatedNotificationPayload.create({
            group: NamedObject.create({ id: 'group-' + name, name: 'Kapoenen' }),
        }).encodeBoxed(),
        organizationId: organization.id,
        group: { key: name, resource: NamedObject.create({ id: name, name }) },
        to: { users: [admin] },
    });
}

async function getPreferences(admin: User) {
    const preferences = await NotificationPreference.select().where('userId', admin.id).fetch();
    return Object.fromEntries(preferences.map(p => [p.channel, p.enabled]));
}

function dashboardUrl(organization: Organization) {
    return `${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}`;
}

async function chooseMenuItem(page: Page, name: string) {
    await page.getByTestId('context-menu-item-title').filter({ hasText: name }).click();
}

test.describe('Notifications @notifications', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
        TestUtils.setPermanentEnvironment('singleOrganization', undefined);
    });

    test.afterAll(async () => {
        await WorkerData.resetDatabase();
    });

    test('an administrator reads notifications and manages which ones they receive', async ({ page }) => {
        const { organization, admin } = await createAdmin({ featureFlags: ['notifications'] });
        await sendRegistrationNotification(organization, admin, 'Jan Peeters');
        await sendRegistrationNotification(organization, admin, 'Sarah Janssens');

        await loginAs({ page, user: admin });
        await page.goto(dashboardUrl(organization));

        const button = page.getByTestId('notifications-button');
        const unreadCount = page.getByTestId('notifications-unread-count');
        await expect(unreadCount).toHaveText('2', { timeout: 20_000 });

        await button.click();
        const view = page.getByTestId('notifications-view');
        const rows = view.getByTestId('notification-row');
        await expect(rows).toHaveCount(2);

        // Newest first, both unread
        await expect(rows.nth(0)).toContainText('Nieuwe inschrijving voor Kapoenen');
        await expect(rows.nth(0)).toContainText('Sarah Janssens');
        await expect(rows.nth(1)).toContainText('Jan Peeters');
        await expect(view.getByTestId('notification-unread-dot')).toHaveCount(2);

        // The view has a fixed height, so it doesn't grow while more notifications load
        await expect.poll(async () => (await view.boundingBox())?.height).toBe(400);

        await test.step('mark one notification as read from its context menu', async () => {
            await rows.nth(1).click({ button: 'right' });
            await chooseMenuItem(page, 'Markeren als gelezen');

            await expect(rows.nth(1)).toHaveAttribute('data-unread', 'false');
            await expect(rows.nth(0)).toHaveAttribute('data-unread', 'true');
            await expect(unreadCount).toHaveText('1');
        });

        await test.step('mark all notifications as read', async () => {
            await view.getByTestId('notifications-more-button').click();
            await chooseMenuItem(page, 'Alles markeren als gelezen');

            await expect(view.getByTestId('notification-unread-dot')).toHaveCount(0);
            await expect(unreadCount).toBeHidden();
        });

        await test.step('unsubscribe from a type from the context menu of a notification', async () => {
            await rows.nth(0).click({ button: 'right' });
            await chooseMenuItem(page, 'Uitschrijven voor dit type meldingen');

            await expect.poll(() => getPreferences(admin)).toEqual({
                [NotificationChannel.InApp]: false,
                [NotificationChannel.Push]: false,
            });
        });

        await test.step('turn a channel back on in the settings', async () => {
            await view.getByTestId('notifications-more-button').click();
            await chooseMenuItem(page, 'Instellingen voor meldingen');

            const settings = page.getByTestId('notification-settings-view');
            const row = settings.locator(`[data-testid="notification-preference-row"][data-type="${NotificationType.RegistrationCreated}"]`);
            await expect(row).toBeVisible();

            const inApp = row.getByTestId('notification-preference-' + NotificationChannel.InApp);
            const push = row.getByTestId('notification-preference-' + NotificationChannel.Push);
            await expect(inApp.locator('input')).not.toBeChecked();
            await expect(push.locator('input')).not.toBeChecked();

            await push.click();
            await expect(push.locator('input')).toBeChecked();
            await expect.poll(() => getPreferences(admin)).toEqual({
                [NotificationChannel.InApp]: false,
                [NotificationChannel.Push]: true,
            });
        });
    });

    test('clicking a registration notification marks it as read and opens the registrations of its group, event or waiting list', async ({ page }) => {
        const { organization, admin } = await createAdmin({ featureFlags: ['notifications'] });

        const waitingList = await new GroupFactory({ organization, type: GroupType.WaitingList, name: new TranslatedString('Wachtlijst Kapoenen') }).create();
        const group = await new GroupFactory({ organization, name: new TranslatedString('Kapoenen'), waitingListId: waitingList.id }).create();
        const organizationPeriod = await organization.getPeriod();
        organizationPeriod.settings.rootCategory?.groupIds.push(group.id);
        await organizationPeriod.save();

        // A group of another period than the current one
        const otherPeriod = await new RegistrationPeriodFactory({
            organization,
            startDate: new Date(2025, 0, 1),
            endDate: new Date(2025, 11, 31),
        }).create();
        otherPeriod.customName = 'Ander werkjaar';
        await otherPeriod.save();
        const otherOrganizationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: otherPeriod }).create();
        const otherPeriodGroup = await new GroupFactory({ organization, period: otherPeriod, name: new TranslatedString('Welpen') }).create();
        otherOrganizationPeriod.settings.rootCategory?.groupIds.push(otherPeriodGroup.id);
        await otherOrganizationPeriod.save();
        const eventGroup = await new GroupFactory({ organization, type: GroupType.EventRegistration, name: new TranslatedString('Weekend') }).create();
        const event = await new EventFactory({ organization, group: eventGroup, name: 'Weekend' }).create();

        const scenarios = [
            { group: waitingList, url: '/leden/kapoenen/wachtlijst' },
            { group: eventGroup, url: `/activiteiten/${event.id}/inschrijvingen` },
            { group, url: '/leden/kapoenen/inschrijvingen' },
            { group: otherPeriodGroup, url: '/leden/p/ander-werkjaar/welpen/inschrijvingen' },
        ];

        // Sent in this order so the list shows them newest first, in the order of the scenarios
        for (const scenario of [...scenarios].reverse()) {
            await NotificationService.send({
                type: NotificationType.RegistrationCreated,
                payload: RegistrationCreatedNotificationPayload.create({
                    group: NamedObject.create({ id: scenario.group.id, name: scenario.group.settings.name.toString() }),
                }).encodeBoxed(),
                organizationId: organization.id,
                group: { key: scenario.group.id, resource: NamedObject.create({ id: 'member', name: 'Jan Peeters' }) },
                to: { users: [admin] },
            });
        }

        await loginAs({ page, user: admin });
        await page.goto(dashboardUrl(organization));

        for (const [index, scenario] of scenarios.entries()) {
            await test.step(scenario.url, async () => {
                await page.getByTestId('notifications-button').click();
                const row = page.getByTestId('notifications-view').getByTestId('notification-row').nth(index);
                await expect(row).toContainText(scenario.group.settings.name.toString());
                await row.click();

                await expect(page).toHaveURL(new RegExp(scenario.url + '$'), { timeout: 20_000 });
                await expect(page.getByTestId('notifications-view')).toBeHidden();

                const recipients = await NotificationRecipient.select().where('userId', admin.id).fetch();
                const notifications = await Notification.select().where('id', recipients.map(r => r.notificationId)).fetch();
                const notification = notifications.find(n => n.groupKey === scenario.group.id)!;
                expect(recipients.find(r => r.notificationId === notification.id)!.readAt).not.toBeNull();
            });
        }
    });

    test('the unread count reloads when the window gets focus again, but not right after the last reload', async ({ page }) => {
        const { organization, admin } = await createAdmin({ featureFlags: ['notifications'] });
        await sendRegistrationNotification(organization, admin, 'Jan Peeters');

        let countRequests = 0;
        page.on('request', (request) => {
            if (request.url().includes('/notifications/unread-count')) {
                countRequests++;
            }
        });

        await page.clock.install();
        await page.clock.resume();
        await loginAs({ page, user: admin });
        await page.goto(dashboardUrl(organization));

        const unreadCount = page.getByTestId('notifications-unread-count');
        await expect(unreadCount).toHaveText('1', { timeout: 20_000 });
        const requestsAfterLoad = countRequests;

        await sendRegistrationNotification(organization, admin, 'Sarah Janssens');
        // Switching to another application and back
        const focusWindow = () => page.evaluate(() => {
            window.dispatchEvent(new Event('blur'));
            window.dispatchEvent(new Event('focus'));
        });

        await test.step('focus right after the last load does not reload', async () => {
            await focusWindow();
            await page.waitForTimeout(1_000);
            expect(countRequests).toBe(requestsAfterLoad);
            await expect(unreadCount).toHaveText('1');
        });

        await test.step('focus a while later reloads the count', async () => {
            await page.clock.fastForward(61_000);
            await page.clock.resume();
            await focusWindow();
            await expect(unreadCount).toHaveText('2');
        });
    });

    test.describe('saving preferences on a bad network', () => {
        async function openSettings(page: Page) {
            const { organization, admin } = await createAdmin({ featureFlags: ['notifications'] });
            await loginAs({ page, user: admin });
            await page.goto(dashboardUrl(organization));

            await page.getByTestId('notifications-button').click();
            await page.getByTestId('notifications-view').getByTestId('notifications-more-button').click();
            await chooseMenuItem(page, 'Instellingen voor meldingen');

            const row = page.getByTestId('notification-settings-view').locator(`[data-testid="notification-preference-row"][data-type="${NotificationType.RegistrationCreated}"]`);
            const inApp = row.getByTestId('notification-preference-' + NotificationChannel.InApp);
            const push = row.getByTestId('notification-preference-' + NotificationChannel.Push);
            await expect(inApp.locator('input')).toBeChecked({ timeout: 20_000 });
            return { admin, inApp, push };
        }

        test('a failed save restores the checkbox, also when the connection is gone', async ({ page }) => {
            const { admin, push } = await openSettings(page);

            await page.route('**/notifications/preferences**', route => route.abort('internetdisconnected'));
            await push.click();

            await expect(page.getByTestId('toast-box')).toBeVisible();
            await expect(push.locator('input')).toBeChecked();
            expect(await getPreferences(admin)).toEqual({});
        });

        test('a slow save completes after closing the settings, and quick changes are all stored in order', async ({ page }) => {
            const { admin, inApp, push } = await openSettings(page);

            await page.route('**/notifications/preferences**', async (route) => {
                await new Promise(resolve => setTimeout(resolve, 1_000));
                await route.continue().catch(() => {});
            });

            await inApp.click();
            await push.click();
            await push.click();
            await push.click();
            await expect(inApp.locator('input')).not.toBeChecked();
            await expect(push.locator('input')).not.toBeChecked();

            await page.keyboard.press('Escape');
            await page.keyboard.press('Escape');
            await expect(page.getByTestId('notification-settings-view')).toBeHidden();

            await expect.poll(() => getPreferences(admin), { timeout: 15_000 }).toEqual({
                [NotificationChannel.InApp]: false,
                [NotificationChannel.Push]: false,
            });
        });
    });

    test('notifications are also available in the navigation bar on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const { organization, admin } = await createAdmin({ featureFlags: ['notifications'] });
        await sendRegistrationNotification(organization, admin, 'Jan Peeters');

        await loginAs({ page, user: admin });
        await page.goto(dashboardUrl(organization));

        const button = page.getByTestId('notifications-button').filter({ visible: true });
        await expect(button.getByTestId('notifications-unread-count')).toHaveText('1', { timeout: 20_000 });

        await button.click();
        const view = page.getByTestId('notifications-view');
        await expect(view.getByTestId('notification-row')).toHaveCount(1);
        await expect(view.getByTestId('notification-row')).toContainText('Jan Peeters');
    });

    test('the notifications button is hidden without the feature flag', async ({ page }) => {
        const { organization, admin } = await createAdmin({ featureFlags: [] });
        await sendRegistrationNotification(organization, admin, 'Jan Peeters');

        await loginAs({ page, user: admin });
        await page.goto(dashboardUrl(organization));

        await expect(page.locator('.account-switcher')).toBeVisible({ timeout: 20_000 });
        await expect(page.getByTestId('notifications-button')).toBeHidden();
    });
});
