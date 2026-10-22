// test should always be imported first
import { test, setup } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import type { User } from '@stamhoofd/models';
import { EventFactory, Organization, OrganizationFactory, RegistrationPeriod, UserFactory } from '@stamhoofd/models';
import { appToUri, PermissionRole, PermissionRoleDetailed, Permissions, PermissionsResourceKey, ResourcePermissions, STPackageBundle, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { AccessRight } from '@stamhoofd/types/AccessRight';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { PermissionsResourceType } from '@stamhoofd/types/PermissionsResourceType';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

test.describe('Event access management @event-resource-roles', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    async function openDashboard({ page, organization, user }: { page: Page; organization: Organization; user: User }) {
        const token = await SessionService.createSession(user);
        const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
        const organizationId = organization.id;

        await page.addInitScript(({ organizationId, tokenString }) => {
            window.localStorage.setItem('token-' + organizationId, tokenString);
        }, { organizationId, tokenString });

        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}`);
    }

    async function openCalendar({ page, year }: { page: Page; year: number }) {
        const tab = page.locator('[data-testid="tab-button"][data-tab-id="events"]');
        await expect(tab).toBeVisible();
        await tab.click();
        await expect(page.locator('#settings-view')).toBeVisible();

        await page.locator('.scrollable-segmented-control button', { hasText: String(year) }).first().click();
    }

    test('an admin who can manage an event can give another role access to it', async ({ page }) => {
        test.setTimeout(120_000);
        const runId = `${WorkerData.id}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

        // The events calendar only offers the current year and the two before it
        const year = new Date().getFullYear() - 1;

        // Full access to all groups including managing their events, but not a full organization admin
        const leaderRole = PermissionRoleDetailed.create({
            name: 'Leiding',
            resources: new Map([[PermissionsResourceType.Groups, new Map([[
                PermissionsResourceKey.CurrentPeriod,
                ResourcePermissions.create({ level: PermissionLevel.Full, accessRights: [AccessRight.EventWrite] }),
            ]])]]),
        });
        const otherRole = PermissionRoleDetailed.create({ name: 'Penningmeester' });

        const organization = await new OrganizationFactory({
            name: `Event Roles Organization ${runId}`,
            uri: `event-roles-${runId}`,
            packages: [STPackageBundle.Members],
            roles: [leaderRole, otherRole],
        }).create();
        await STPackageService.updateOrganizationPackages(organization.id);

        const period = await RegistrationPeriod.getByID(organization.periodId);
        if (!period) {
            throw new Error('Missing registration period for organization');
        }
        period.startDate = new Date(year, 0, 1, 0, 0, 0, 0);
        period.endDate = new Date(year, 11, 31, 23, 59, 59, 999);
        await period.save();

        const eventName = `Kamp ${runId}`;
        const event = await new EventFactory({
            organization,
            name: eventName,
            startDate: new Date(year, 6, 1, 10, 0, 0, 0),
            endDate: new Date(year, 6, 10, 12, 0, 0, 0),
        }).create();

        const user = await new UserFactory({
            firstName: 'Event',
            lastName: 'Admin',
            email: `event-roles-${runId}@test.be`,
            organization,
            permissions: Permissions.create({
                roles: [PermissionRole.create({ id: leaderRole.id, name: leaderRole.name })],
            }),
        }).create();

        await page.setViewportSize({ width: 1280, height: 800 });
        await openDashboard({ page, organization, user });

        await openCalendar({ page, year });
        await page.locator('#settings-view .st-list-item:visible h3 span').filter({ hasText: eventName }).click();
        await page.locator('.st-list-item:visible').filter({ hasText: 'Toegangsbeheer' }).click();

        const popup = page.locator('div.popup.focused').last();
        await expect(popup.getByTestId('save-view')).toBeVisible();

        const otherRoleRow = popup.locator('.st-list-item').filter({ hasText: otherRole.name });
        await otherRoleRow.click();
        await expect(otherRoleRow.locator('input[type="checkbox"]')).toBeChecked();
        await popup.getByTestId('save-button').click();

        const successToast = page.getByText('De wijzigingen zijn opgeslagen');
        const errorBox = popup.getByTestId('input-error');
        await expect(successToast.or(errorBox)).toBeVisible();
        await expect(errorBox).toHaveCount(0);
        await expect(successToast).toBeVisible();

        const updated = await Organization.getByID(organization.id);
        const updatedRole = updated?.privateMeta.roles.find(r => r.id === otherRole.id);
        expect(updatedRole?.resources.get(PermissionsResourceType.Events)?.get(event.id)?.level).toBe(PermissionLevel.Full);
    });
});
