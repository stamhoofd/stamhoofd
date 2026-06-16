// test should always be imported first
import { test, setup } from '../test-fixtures/base.js';
setup();

// other imports
import type { Browser, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { I18n } from '@stamhoofd/backend-i18n';
import type { Organization } from '@stamhoofd/models';
import { OrganizationFactory, PasswordToken, Platform, Token, User, UserFactory } from '@stamhoofd/models';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { PermissionLevel, PermissionRoleDetailed, Permissions, STPackageBundle, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

/**
 * These tests cover the admin invite flow, which uses password tokens under the hood:
 *  1. A full admin invites a new admin via the UI (organization admins in the dashboard
 *     app, platform admins in the admin app).
 *  2. In a new browser session (clean localstorage) the invited user opens the
 *     PasswordToken link that normally would be sent via email.
 *  3. The invited user gets the option to choose a password.
 *  4. After choosing a password the invited user is signed in.
 *
 * The invited email address can belong to an existing user (with or without an account
 * or permissions) or to a nobody: in that case a new user is created by the invite.
 *
 * They are run in three environments: organization mode, platform mode and
 * single organization mode. Setup is based on routing.spec.ts and reset-password.spec.ts.
 */

const PASSWORD = 'testAbc123456';
const NEW_PASSWORD = 'inviteAbc789012';
const ORGANIZATION_ROLE = 'Activiteitenverantwoordelijke';
const PLATFORM_ROLE = 'Regioverantwoordelijke';

// nl-BE, matching the locale used everywhere else in the tests
const i18n = new I18n(I18n.defaultLanguage, I18n.defaultCountry);

type Rights = 'full' | { role: string };

/**
 * Environment specific data for the shared scenarios.
 */
type EnvContext = {
    organization: Organization;
    /** A second organization to invite admins of other organizations (platform mode only) */
    otherOrganization: Organization | null;
    /** Full admin of `organization`: invites admins in the dashboard app */
    organizationAdmin: User;
    /** Platform admin: invites admins in the admin app */
    platformAdmin: User;
    /** Admins settings page of `organization` in the dashboard app */
    adminsUrl: string;
    /** Admins settings page of the platform in the admin app */
    platformAdminsUrl: string;
};

function randomEmail(prefix: string) {
    return prefix + '-' + Math.floor(Math.random() * 1_000_000_000) + '@example.com';
}

/**
 * A unique name for an invited admin. The list shows multiple admins at once (they
 * accumulate within an environment), so every invited admin needs a distinct name to
 * avoid matching another admin's row.
 */
function randomName(prefix: string) {
    return { firstName: prefix, lastName: 'Beheerder-' + Math.floor(Math.random() * 1_000_000_000) };
}

/**
 * Sign in by setting the token in local storage (same as routing.spec.ts).
 */
async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await Token.createToken(user);
    const tokenString = JSON.stringify(
        new TokenStruct(token).encode({ version: Version }),
    );

    const organizationId = user.organizationId;
    await page.addInitScript(({ organizationId, tokenString }) => {
        window.localStorage.removeItem('user-platform');

        if (organizationId) {
            window.localStorage.removeItem('user-' + organizationId);
            window.localStorage.setItem('token-' + organizationId, tokenString);
        } else {
            window.localStorage.setItem('token-platform', tokenString);
        }
    }, { organizationId, tokenString });
}

function activePopup(page: Page) {
    return page.locator('div.popup.focused').last();
}

/**
 * Open the admins settings page and the "new admin" popup.
 */
async function openNewAdminPopup(page: Page, adminsUrl: string): Promise<Locator> {
    await page.goto(adminsUrl);

    const addButton = page.getByTestId('add-admin-button');
    await expect(addButton).toBeVisible({ timeout: 20_000 });
    await addButton.click();

    const popup = activePopup(page);
    await expect(popup.getByTestId('save-view')).toBeVisible();
    return popup;
}

/**
 * Fill the new admin form: name, email and the requested rights (full access checkbox
 * or the checkbox of a specific role).
 */
async function fillAdminForm(popup: Locator, { firstName, lastName, email, rights }: { firstName: string; lastName: string; email: string; rights: Rights | null }) {
    await popup.locator('input[autocomplete="given-name"]').fill(firstName);
    await popup.locator('input[autocomplete="family-name"]').fill(lastName);
    await popup.getByTestId('email-input').fill(email);

    if (rights === 'full') {
        await popup.getByTestId('full-access-checkbox').check();
    } else if (rights !== null) {
        await popup.locator('label.st-list-item', { hasText: rights.role }).getByTestId('checkbox').check();
    }
}

/**
 * The label shown in the admins list for the requested rights: the full access label or
 * the role name.
 */
function expectedRightsLabel(rights: Rights): string {
    return rights === 'full' ? $t('Hoofdbeheerders') : rights.role;
}

/**
 * Invite an admin via the UI, wait until the popup is closed (= request succeeded) and
 * verify the new admin is visible in the list on the admins settings page.
 *
 * The row must immediately show the correct name and rights, without a page reload.
 * Regression guard: a freshly invited admin briefly rendered without a name (falling back
 * to the email) and without permissions ("Geen toegangsrechten") until the page was reloaded.
 */
async function inviteAdminViaUI(page: Page, { adminsUrl, email, rights, expectedName }: { adminsUrl: string; email: string; rights: Rights; expectedName?: string }) {
    const { firstName, lastName } = randomName('Nieuwe');
    // For an existing user the backend keeps the existing name, so the caller passes it in.
    // For a new (nameless) user the name we fill in is the one that gets shown.
    const name = expectedName ?? (firstName + ' ' + lastName);

    const popup = await openNewAdminPopup(page, adminsUrl);
    await fillAdminForm(popup, { firstName, lastName, email, rights });

    await popup.getByTestId('save-button').click();
    await expect(popup.getByTestId('save-view')).toHaveCount(0, { timeout: 20_000 });

    // The new admin should appear in the list on the settings page, immediately showing the
    // correct name and rights (without reloading the page).
    const row = page.locator('.st-list-item', { hasText: email });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.locator('h2.style-title-list')).toHaveText(name);
    await expect(row).toContainText(expectedRightsLabel(rights));
    await expect(row).not.toContainText($t('Geen toegangsrechten'));
}

/**
 * There should be exactly one user with this email: inviting an existing email address
 * should never create a duplicate user.
 */
async function getSingleUserByEmail(email: string): Promise<User> {
    const users = await User.where({ email });
    expect(users).toHaveLength(1);
    return users[0];
}

/**
 * Find the PasswordToken created by the invite, open the link that would normally be
 * sent via email in a new browser session, choose a password and check that the user
 * is signed in and the password is set in the database.
 */
async function openInviteAndChoosePassword(browser: Browser, { userId, organization }: { userId: string; organization: Organization | null }) {
    const invitedUser = await User.getByID(userId);
    const oldPassword = invitedUser?.password ?? null;

    // Find the stored PasswordToken and build the url from the invite email
    const passwordToken = await PasswordToken.select().where('userId', userId).first(true);
    const url = await passwordToken.getPasswordRecoveryUrl(organization, i18n);

    // A new browser session with a clean local storage
    const context = await browser.newContext();
    try {
        const page = await context.newPage();

        await test.step('Navigate to ' + url + ' and choose a password', async () => {
            await page.goto(url);

            const form = page.locator('form.forgot-password-reset-view');
            await expect(form).toBeVisible({ timeout: 20_000 });

            // The user has the option to choose a password
            const passwordInputs = form.locator('input[autocomplete="new-password"]');
            await expect(passwordInputs.nth(0)).toBeVisible();
            await expect(passwordInputs.nth(1)).toBeVisible();
            await passwordInputs.nth(0).fill(NEW_PASSWORD);
            await passwordInputs.nth(1).fill(NEW_PASSWORD);

            // Accept all required policy checkboxes (their amount depends on the configuration)
            const policies = form.getByTestId('checkbox');
            const count = await policies.count();
            for (let i = 0; i < count; i++) {
                await policies.nth(i).check();
            }

            await form.locator('#submit').click();

            // The user is now signed in
            await expect(form).toBeHidden({ timeout: 20_000 });
            await expect(page.locator('[data-testid="login-view"]')).toBeHidden();
            await expect.poll(
                async () => page.evaluate(() => Object.keys(window.localStorage).some(key => key.startsWith('token-') && !!window.localStorage.getItem(key))),
                { timeout: 20_000 },
            ).toBe(true);
        });
    } finally {
        await context.close();
    }

    // The password is set (or changed) in the database
    const updatedUser = await User.getByID(userId);
    expect(updatedUser?.password).toBeTruthy();
    expect(updatedUser?.password).not.toBe(oldPassword);
}

function organizationPermissionsFor(user: User, organization: Organization) {
    return user.permissions?.organizationPermissions.get(organization.id);
}

/**
 * The scenarios that are identical in all three environments. The context getter is
 * evaluated inside the tests, after the beforeAll hooks of the environment have run.
 */
function defineCommonScenarios(getContext: () => EnvContext, { includeOtherOrganization }: { includeOtherOrganization: boolean }) {
    test('invite a new user with full access to the organization', async ({ page, browser }) => {
        const ctx = getContext();
        const email = randomEmail('invite-new-full');

        await loginAs({ page, user: ctx.organizationAdmin });
        await inviteAdminViaUI(page, { adminsUrl: ctx.adminsUrl, email, rights: 'full' });

        const invited = await getSingleUserByEmail(email);
        expect(invited.password).toBeNull(); // no account yet
        expect(organizationPermissionsFor(invited, ctx.organization)?.level).toBe(PermissionLevel.Full);

        await openInviteAndChoosePassword(browser, { userId: invited.id, organization: ctx.organization });
    });

    test('invite a new user with a specific role to the organization', async ({ page, browser }) => {
        const ctx = getContext();
        const email = randomEmail('invite-new-role');

        await loginAs({ page, user: ctx.organizationAdmin });
        await inviteAdminViaUI(page, { adminsUrl: ctx.adminsUrl, email, rights: { role: ORGANIZATION_ROLE } });

        const invited = await getSingleUserByEmail(email);
        const permissions = organizationPermissionsFor(invited, ctx.organization);
        expect(permissions?.level).toBe(PermissionLevel.None);
        expect(permissions?.roles.map(r => r.name)).toContain(ORGANIZATION_ROLE);

        await openInviteAndChoosePassword(browser, { userId: invited.id, organization: ctx.organization });
    });

    test('invite a new user without any role shows an error', async ({ page }) => {
        const ctx = getContext();
        const email = randomEmail('invite-new-none');

        await loginAs({ page, user: ctx.organizationAdmin });
        const popup = await openNewAdminPopup(page, ctx.adminsUrl);
        await fillAdminForm(popup, { ...randomName('Nieuwe'), email, rights: null });
        await popup.getByTestId('save-button').click();

        // An error should be shown, the popup should stay open and no user may be created
        await expect(popup.getByTestId('input-error')).toBeVisible();
        await expect(popup.getByTestId('input-error')).toHaveText($t('Kies minstens één beheerdersrol voor je een beheerder toevoegt'));
        await expect(popup.getByTestId('save-view')).toBeVisible();
        expect(await User.where({ email })).toHaveLength(0);
    });

    test('invite an existing platform admin to the organization', async ({ page, browser }) => {
        const ctx = getContext();
        const existing = await new UserFactory({
            email: randomEmail('invite-platform-admin'),
            password: PASSWORD,
            ...randomName('Platform'),
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        await loginAs({ page, user: ctx.organizationAdmin });
        await inviteAdminViaUI(page, { adminsUrl: ctx.adminsUrl, email: existing.email, expectedName: existing.firstName + ' ' + existing.lastName, rights: 'full' });

        // The permissions are merged into the existing user
        const merged = await getSingleUserByEmail(existing.email);
        expect(merged.id).toBe(existing.id);
        expect(organizationPermissionsFor(merged, ctx.organization)?.level).toBe(PermissionLevel.Full);
        expect(merged.permissions?.globalPermissions?.level).toBe(PermissionLevel.Full);

        await openInviteAndChoosePassword(browser, { userId: existing.id, organization: ctx.organization });
    });

    test('invite an existing admin of the organization again', async ({ page, browser }) => {
        const ctx = getContext();
        const existing = await new UserFactory({
            email: randomEmail('invite-org-admin'),
            password: PASSWORD,
            ...randomName('Bestaande'),
            organization: ctx.organization,
            permissions: Permissions.create({ level: PermissionLevel.Write }),
        }).create();

        await loginAs({ page, user: ctx.organizationAdmin });
        await inviteAdminViaUI(page, { adminsUrl: ctx.adminsUrl, email: existing.email, expectedName: existing.firstName + ' ' + existing.lastName, rights: 'full' });

        const merged = await getSingleUserByEmail(existing.email);
        expect(merged.id).toBe(existing.id);
        expect(organizationPermissionsFor(merged, ctx.organization)?.level).toBe(PermissionLevel.Full);

        await openInviteAndChoosePassword(browser, { userId: existing.id, organization: ctx.organization });
    });

    if (includeOtherOrganization) {
        test('invite an admin of a different organization to the organization', async ({ page, browser }) => {
            const ctx = getContext();
            const otherOrganization = ctx.otherOrganization!;
            const existing = await new UserFactory({
                email: randomEmail('invite-other-org-admin'),
                password: PASSWORD,
                ...randomName('Andere'),
                organization: otherOrganization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            await loginAs({ page, user: ctx.organizationAdmin });
            await inviteAdminViaUI(page, { adminsUrl: ctx.adminsUrl, email: existing.email, expectedName: existing.firstName + ' ' + existing.lastName, rights: 'full' });

            // The user now has full access to both organizations
            const merged = await getSingleUserByEmail(existing.email);
            expect(merged.id).toBe(existing.id);
            expect(organizationPermissionsFor(merged, ctx.organization)?.level).toBe(PermissionLevel.Full);
            expect(organizationPermissionsFor(merged, otherOrganization)?.level).toBe(PermissionLevel.Full);

            await openInviteAndChoosePassword(browser, { userId: existing.id, organization: ctx.organization });
        });
    }

    test('invite an existing user without permissions to the organization', async ({ page, browser }) => {
        const ctx = getContext();
        const existing = await new UserFactory({
            email: randomEmail('invite-normal-user'),
            password: PASSWORD,
            ...randomName('Gewone'),
            organization: ctx.organization,
            permissions: null,
        }).create();

        await loginAs({ page, user: ctx.organizationAdmin });
        await inviteAdminViaUI(page, { adminsUrl: ctx.adminsUrl, email: existing.email, expectedName: existing.firstName + ' ' + existing.lastName, rights: 'full' });

        const merged = await getSingleUserByEmail(existing.email);
        expect(merged.id).toBe(existing.id);
        expect(organizationPermissionsFor(merged, ctx.organization)?.level).toBe(PermissionLevel.Full);

        await openInviteAndChoosePassword(browser, { userId: existing.id, organization: ctx.organization });
    });

    test('invite a new user with full access to the platform', async ({ page, browser }) => {
        const ctx = getContext();
        const email = randomEmail('invite-new-platform-full');

        await loginAs({ page, user: ctx.platformAdmin });
        await inviteAdminViaUI(page, { adminsUrl: ctx.platformAdminsUrl, email, rights: 'full' });

        const invited = await getSingleUserByEmail(email);
        expect(invited.password).toBeNull(); // no account yet
        expect(invited.permissions?.globalPermissions?.level).toBe(PermissionLevel.Full);

        // Platform admins are not scoped to an organization
        await openInviteAndChoosePassword(browser, { userId: invited.id, organization: null });
    });

    test('invite a new user with a specific role to the platform', async ({ page, browser }) => {
        const ctx = getContext();
        const email = randomEmail('invite-new-platform-role');

        await loginAs({ page, user: ctx.platformAdmin });
        await inviteAdminViaUI(page, { adminsUrl: ctx.platformAdminsUrl, email, rights: { role: PLATFORM_ROLE } });

        const invited = await getSingleUserByEmail(email);
        expect(invited.permissions?.globalPermissions?.level).toBe(PermissionLevel.None);
        expect(invited.permissions?.globalPermissions?.roles.map(r => r.name)).toContain(PLATFORM_ROLE);

        await openInviteAndChoosePassword(browser, { userId: invited.id, organization: null });
    });
}

test.describe('Admin invites @invite-admin', () => {
    const domain = WorkerData.urls.dashboard;

    /**
     * Add a role to the platform that can be selected when inviting platform admins.
     */
    async function createPlatformRole() {
        const platform = await Platform.getForEditing();
        platform.privateConfig.roles = [
            PermissionRoleDetailed.create({ name: PLATFORM_ROLE, level: PermissionLevel.Read }),
        ];
        await platform.save();
    }

    function createOrganizationRole() {
        return PermissionRoleDetailed.create({ name: ORGANIZATION_ROLE, level: PermissionLevel.Read });
    }

    async function createAdmins(organization: Organization) {
        const organizationAdmin = await new UserFactory({
            organization,
            password: PASSWORD,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        const platformAdmin = await new UserFactory({
            password: PASSWORD,
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        return { organizationAdmin, platformAdmin };
    }

    test.describe('Organization mode', () => {
        let organization: Organization;
        let organizationAdmin: User;
        let platformAdmin: User;

        test.beforeAll(async () => {
            TestUtils.setPermanentEnvironment('userMode', 'organization');
            TestUtils.setPermanentEnvironment('singleOrganization', undefined);
            organization = await new OrganizationFactory({
                packages: [STPackageBundle.Webshops, STPackageBundle.Members],
                roles: [createOrganizationRole()],
            }).create();
            await STPackageService.updateOrganizationPackages(organization.id);
            await createPlatformRole();
            ({ organizationAdmin, platformAdmin } = await createAdmins(organization));
        });

        test.afterAll(async () => {
            await WorkerData.resetDatabase();
        });

        defineCommonScenarios(() => ({
            organization,
            otherOrganization: null,
            organizationAdmin,
            platformAdmin,
            adminsUrl: domain + '/beheerders/' + organization.uri + '/instellingen/beheerders',
            platformAdminsUrl: domain + '/platform/instellingen/beheerders',
        }), { includeOtherOrganization: false });
    });

    test.describe('Platform mode', () => {
        let organization: Organization;
        let otherOrganization: Organization;
        let organizationAdmin: User;
        let platformAdmin: User;

        test.beforeAll(async () => {
            TestUtils.setPermanentEnvironment('userMode', 'platform');
            TestUtils.setPermanentEnvironment('singleOrganization', undefined);
            organization = await new OrganizationFactory({
                roles: [createOrganizationRole()],
            }).create();
            otherOrganization = await new OrganizationFactory({}).create();
            await createPlatformRole();
            ({ organizationAdmin, platformAdmin } = await createAdmins(organization));
        });

        test.afterAll(async () => {
            await WorkerData.resetDatabase();
        });

        defineCommonScenarios(() => ({
            organization,
            otherOrganization,
            organizationAdmin,
            platformAdmin,
            adminsUrl: domain + '/beheerders/' + organization.uri + '/instellingen/beheerders',
            platformAdminsUrl: domain + '/platform/instellingen/beheerders',
        }), { includeOtherOrganization: true });
    });

    test.describe('Single organization mode', () => {
        let organization: Organization;
        let organizationAdmin: User;
        let platformAdmin: User;

        test.beforeAll(async () => {
            TestUtils.setPermanentEnvironment('userMode', 'platform');
            organization = await new OrganizationFactory({
                roles: [createOrganizationRole()],
            }).create();
            TestUtils.setPermanentEnvironment('singleOrganization', organization.id);
            await createPlatformRole();
            ({ organizationAdmin, platformAdmin } = await createAdmins(organization));
        });

        test.afterAll(async () => {
            await WorkerData.resetDatabase();
        });

        defineCommonScenarios(() => ({
            organization,
            otherOrganization: null,
            organizationAdmin,
            platformAdmin,
            // In single organization mode the dashboard urls don't contain the organization uri
            adminsUrl: domain + '/beheerders/instellingen/beheerders',
            platformAdminsUrl: domain + '/platform/instellingen/beheerders',
        }), { includeOtherOrganization: false });
    });
});
