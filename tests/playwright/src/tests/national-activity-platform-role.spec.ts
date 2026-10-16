// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import type { User } from '@stamhoofd/models';
import { EventFactory, GroupFactory, MemberFactory, OrganizationFactory, Platform, RegistrationFactory, UserFactory } from '@stamhoofd/models';
import { EventMeta, GroupType, PermissionLevel, PermissionRoleDetailed, Permissions, PermissionsResourceType, ResourcePermissions, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await SessionService.createSession(user);
    const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));

    await page.addInitScript(({ tokenString }) => {
        window.localStorage.setItem('token-platform', tokenString);
    }, { tokenString });
}

test.describe('National activity access through a platform role @national-activity-platform-role', () => {
    let originalRoles: PermissionRoleDetailed[];

    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');
    });

    test.beforeEach(async () => {
        originalRoles = (await Platform.getForEditing()).privateConfig.roles;
    });

    test.afterEach(async () => {
        const platform = await Platform.getForEditing();
        platform.privateConfig.roles = originalRoles;
        await platform.save();
        await WorkerData.resetDatabase();
    });

    test('A user with a platform role on a national activity can view its registrations', async ({ page }) => {
        const runId = `${WorkerData.id}-${Date.now()}`;

        // A national activity: the group belongs to an organization, the event itself does not
        const organization = await new OrganizationFactory({
            name: `National Activity Organization ${runId}`,
            uri: `national-activity-${runId}`,
        }).create();
        const group = await new GroupFactory({ organization, type: GroupType.EventRegistration }).create();
        const event = await new EventFactory({
            name: `National activity ${runId}`,
            group,
            meta: EventMeta.create({ visible: true }),
        }).create();
        expect(event.organizationId).toBeNull();

        const memberNames = [`First member ${runId}`, `Second member ${runId}`];
        for (const firstName of memberNames) {
            const member = await new MemberFactory({ organization, firstName, lastName: 'Test' }).create();
            await new RegistrationFactory({ member, group }).create();
        }

        const role = PermissionRoleDetailed.create({
            name: `National activity role ${runId}`,
            resources: new Map([[
                PermissionsResourceType.Events,
                new Map([[event.id, ResourcePermissions.create({ level: PermissionLevel.Write })]]),
            ]]),
        });
        const platform = await Platform.getForEditing();
        platform.privateConfig.roles = [...platform.privateConfig.roles, role];
        await platform.save();

        const user = await new UserFactory({
            email: `national-activity-${runId}@test.be`,
            globalPermissions: Permissions.create({ level: PermissionLevel.None, roles: [role] }),
        }).create();

        await loginAs({ page, user });
        await page.goto(`${WorkerData.urls.dashboard}/platform`);
        await page.locator('[data-testid="tab-button"][data-tab-id="events"]:visible').first().click();

        const eventRow = page.locator('#settings-view .st-list-item:visible h3 span').filter({ hasText: event.name });
        await expect(eventRow).toHaveCount(1);
        await eventRow.click();

        const registrationsItem = page.locator('.st-list-item', { hasText: 'Ingeschreven leden' }).first();
        await expect(registrationsItem).toBeVisible();
        await registrationsItem.click();

        const table = page.getByTestId('table');
        await expect(table).toBeVisible();
        for (const memberName of memberNames) {
            await expect(table.locator('[data-testid="table-row"]:visible').filter({ hasText: memberName })).toHaveCount(1);
        }
    });
});
