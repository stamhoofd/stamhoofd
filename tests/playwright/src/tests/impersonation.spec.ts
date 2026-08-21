// test should always be imported first
import { test, setup } from '../test-fixtures/base.js';
setup();

// other imports
import type { Browser, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { Organization, User } from '@stamhoofd/models';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import { AuditLog, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { AuditLogType, PermissionLevel, Permissions, STPackageBundle, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

/**
 * Signing in as one of your users to see what they see.
 *
 * An administrator asks for a link from the administrators settings and opens it in a
 * private window, which is why every step here runs in a browser session of its own: the
 * administrator's own session must survive, and a browser that is already signed in has to
 * refuse the link.
 */

const PASSWORD = 'testAbc123456';

function randomEmail(prefix: string) {
    return prefix + '-' + Math.floor(Math.random() * 1_000_000_000) + '@example.com';
}

/**
 * Sign in by setting the token in local storage (same as routing.spec.ts).
 */
async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await SessionService.createSession(user);
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
 * Walk the administrators settings the way an administrator does: open the account of
 * another administrator and ask for an impersonation link.
 */
async function createImpersonationLink(page: Page, { adminsUrl, email }: { adminsUrl: string; email: string }): Promise<string> {
    await page.goto(adminsUrl);

    const row = page.locator('.st-list-item', { hasText: email });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.click();

    const popup = activePopup(page);
    await expect(popup.getByTestId('save-view')).toBeVisible({ timeout: 20_000 });
    await popup.getByTestId('impersonate-admin').click();

    const linkView = page.getByTestId('impersonation-link-view');
    await expect(linkView).toBeVisible({ timeout: 20_000 });

    const input = linkView.getByTestId('impersonation-link');
    await expect(input).toHaveValue(/#impersonate=/, { timeout: 20_000 });
    return await input.inputValue();
}

/**
 * Open the link the way it is meant to be opened: in a browser session that has nobody
 * signed in.
 */
async function openLinkInPrivateWindow(browser: Browser, link: string, run: (page: Page) => Promise<void>) {
    const context = await browser.newContext();
    try {
        const page = await context.newPage();
        await page.goto(link);
        await run(page);
    }
    finally {
        await context.close();
    }
}

function confirmDialog(page: Page) {
    return page.getByTestId('centered-message');
}

async function openAccountSettings(page: Page) {
    await page.locator('.account-switcher').click({ timeout: 20_000 });

    const accountView = page.locator('#account-view');
    await expect(accountView).toBeVisible({ timeout: 20_000 });
    return accountView;
}

test.describe('Impersonation @impersonation', () => {
    const domain = WorkerData.urls.dashboard;

    let organization: Organization;
    let admin: User;
    let other: User;
    let adminsUrl: string;

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
        TestUtils.setPermanentEnvironment('singleOrganization', undefined);

        organization = await new OrganizationFactory({
            packages: [STPackageBundle.Webshops, STPackageBundle.Members],
        }).create();
        await STPackageService.updateOrganizationPackages(organization.id);

        admin = await new UserFactory({
            organization,
            email: randomEmail('impersonation-admin'),
            password: PASSWORD,
            firstName: 'Hoofd',
            lastName: 'Beheerder',
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        other = await new UserFactory({
            organization,
            email: randomEmail('impersonation-target'),
            password: PASSWORD,
            firstName: 'Andere',
            lastName: 'Beheerder',
            permissions: Permissions.create({ level: PermissionLevel.Write }),
        }).create();

        adminsUrl = domain + '/beheerders/' + organization.uri + '/instellingen/beheerders';
    });

    test.afterAll(async () => {
        await WorkerData.resetDatabase();
    });

    test('an administrator can sign in as another administrator through a link', async ({ page, browser }) => {
        await loginAs({ page, user: admin });
        const link = await createImpersonationLink(page, { adminsUrl, email: other.email });

        await openLinkInPrivateWindow(browser, link, async (privatePage) => {
            await test.step('the link asks for a confirmation first', async () => {
                const dialog = confirmDialog(privatePage);
                await expect(dialog).toBeVisible({ timeout: 30_000 });
                await dialog.getByRole('button', { name: 'Ja, inloggen' }).click();
            });

            await test.step('the session is the other administrator, and says who is really acting', async () => {
                const accountView = await openAccountSettings(privatePage);

                await expect(accountView.getByTestId('email-input')).toHaveValue(other.email, { timeout: 20_000 });

                const notice = accountView.getByTestId('impersonation-notice');
                await expect(notice).toBeVisible();
                await expect(notice).toContainText(admin.email);

                // Nothing that would take the account over is offered here.
                await expect(accountView.getByTestId('open-mfa-settings')).toBeHidden();
            });
        });

        // The administrator's own session is untouched: they can keep working.
        await expect(page.locator('.account-switcher')).toBeVisible();

        const logs = await AuditLog.select().where('type', AuditLogType.UserImpersonated).where('objectId', other.id).fetch();
        expect(logs.length).toBe(1);
        expect(logs[0].userId).toBe(admin.id);
    });

    test('a link is refused in a browser that is already signed in', async ({ page, browser }) => {
        await loginAs({ page, user: admin });
        const link = await createImpersonationLink(page, { adminsUrl, email: other.email });

        const context = await browser.newContext();
        try {
            const signedInPage = await context.newPage();
            await loginAs({ page: signedInPage, user: admin });
            await signedInPage.goto(link);

            // No confirmation, no new session: the link has to be opened in a private window.
            await expect(signedInPage.getByTestId('toast-box')).toContainText('privévenster', { timeout: 30_000 });
            await expect(confirmDialog(signedInPage)).toBeHidden();

            const accountView = await openAccountSettings(signedInPage);
            await expect(accountView.getByTestId('email-input')).toHaveValue(admin.email, { timeout: 20_000 });
            await expect(accountView.getByTestId('impersonation-notice')).toBeHidden();
        }
        finally {
            await context.close();
        }
    });
});
