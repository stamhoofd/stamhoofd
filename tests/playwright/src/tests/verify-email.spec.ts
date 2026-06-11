// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { EmailVerificationCode, Organization, OrganizationFactory, User, UserFactory } from '@stamhoofd/models';
import { AcquisitionType, STPackageBundle } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { OnboardingScenario } from '../flows/OnboardingScenario.js';
import { WorkerData } from '../helpers/index.js';

/**
 * These tests cover all the places that should end up on the VerifyEmail route:
 *  1. After logging in as an unverified user
 *  2. After signing up at an existing organization
 *  3. After signing up a new organization (organization mode only)
 *  4. Opening the verification link from the email directly (token + code)
 *  5. Reloading the verify email page (token, but no code)
 *
 * In every scenario we also check:
 *  - the url of the verify email view (/verify-email or /verify-email/<organization-uri>)
 *  - that entering the code (manually or automatically via the link) shows the success toast,
 *    navigates to the correct place (resolved by the auto app based on the user's permissions
 *    and context) and sets the verified column on the user
 *
 * They are run in three environments: organization mode, platform mode and
 * single organization mode (platform mode with a fixed organization).
 *
 * Routing setup is based on routing.spec.ts.
 */

const PASSWORD = 'testAbc123456';
const VERIFY_EMAIL_VIEW = '[data-testid="verify-email-view"]';
const MEMBERS_START_VIEW = '[data-testid="members-start-view"]';

/**
 * Environment specific data for the shared scenarios.
 */
type EnvContext = {
    domain: string;
    /** Organization the verify email view is scoped to, or null when unscoped (platform mode) */
    scope: Organization | null;
    /** Organization whose uri is part of the verify-email url (organization mode only) */
    uriOrganization: Organization | null;
    /** Organization the unverified user belongs to (organization mode only) */
    userOrganization: Organization | undefined;
    /** Url that shows a login view where the login and signup flows can be started */
    loginUrl: string;
    /** Expected url of the member portal where users without permissions land after verification */
    memberPortalUrl: string;
};

function randomEmail(prefix: string) {
    return prefix + '-' + Math.floor(Math.random() * 1_000_000_000) + '@example.com';
}

async function expectVerifyEmailView(page: Page) {
    await expect(page.locator(VERIFY_EMAIL_VIEW)).toBeVisible();
}

async function expectVerifyEmailViewWithToken(page: Page, token: string) {
    await expect(page.locator('[data-token="' + token + '"]')).toBeVisible();
}

async function checkScopedTo({ page, organization }: { page: Page; organization: Organization | null }) {
    await expect(page.locator('[data-organization-scope="' + (organization?.id ?? null) + '"]')).toBeVisible();
}

/**
 * Create an unverified user + the matching verification code (the one that would
 * normally be sent by email). Returns the user and the generated token/code.
 */
async function createUnverifiedUser({ organization, email }: { organization?: Organization; email: string }) {
    const user = await new UserFactory({
        organization,
        email,
        password: PASSWORD,
        verified: false,
    }).create();

    const verificationCode = await EmailVerificationCode.createFor(user, email);

    return { user, token: verificationCode.token, code: verificationCode.code };
}

/**
 * Fetch the verification code that the backend created (and would have emailed)
 * for a user that signed up via the UI.
 */
async function getVerificationCode(email: string): Promise<EmailVerificationCode> {
    const codes = await EmailVerificationCode.where({ email }, { limit: 1 });
    if (codes.length === 0) {
        throw new Error('No verification code found in the database for ' + email);
    }
    return codes[0];
}

/**
 * Build the verify-email url as it would appear in the verification email.
 */
function buildVerifyEmailUrl({ domain, uriOrganization, token, email, code }: { domain: string; uriOrganization: Organization | null; token: string; email: string; code?: string }) {
    const params = new URLSearchParams();
    params.set('token', token);
    params.set('email', email);
    if (code) {
        params.set('code', code);
    }
    return domain + '/verify-email' + (uriOrganization ? '/' + uriOrganization.uri : '') + '?' + params.toString();
}

/**
 * Check the url of the verify email view: /verify-email when unscoped or scoped via
 * the domain (platform and single organization mode), /verify-email/<uri> in organization mode.
 */
async function expectVerifyEmailUrl(page: Page, options: { uriOrganization: Organization | null; token: string; email: string }) {
    const expectedPath = '/nl-BE/verify-email' + (options.uriOrganization ? '/' + options.uriOrganization.uri : '');

    // The url is only updated after a certain timeout, so allow some retries
    await expect(page).toHaveURL(url => url.pathname === expectedPath, { timeout: 5_000 });

    // TODO: the token and email query parameters are not yet added to the url when the app
    // navigates to the verify email view internally. Enable these checks once they are set,
    // so the view also survives a reload right after login/signup:
    await expect(page).toHaveURL(url => url.searchParams.get('token') === options.token, { timeout: 5_000 });
    await expect(page).toHaveURL(url => url.searchParams.get('email') === options.email, { timeout: 5_000 });
}

/**
 * Manually enter the verification code in the code input (submits automatically when complete).
 */
async function fillCode(page: Page, code: string) {
    const input = page.getByTestId('code-input');
    await input.locator('input').nth(0).fill(code);
}

async function expectVerifiedToast(page: Page) {
    // The toast hides automatically after 8 seconds, so it should be checked right after submitting
    // We need a short timeout. If the code is invalid, there is chance the token expires and the verifyEmailView is closed automatically.
    await expect(page.getByTestId('toast-email-verification-succeeded')).toBeVisible({ timeout: 5_000 });
}

/**
 * Users without permissions are redirected to the member portal by the auto app.
 */
async function expectMemberPortal(page: Page, expectedUrl: string) {
    await expect(page.locator(MEMBERS_START_VIEW)).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(expectedUrl, { timeout: 15_000 });
}

async function expectUserVerified(userId: string) {
    const user = await User.getByID(userId);
    expect(user?.verified).toBe(true);
}

/**
 * Fill in the login form (the login view should already be visible) and submit.
 */
async function loginViaUI(page: Page, { email, password }: { email: string; password: string }) {
    await expect(page.locator('[data-testid="login-view"]')).toBeVisible();

    const emailInput = page.getByTestId('email-input');
    await emailInput.click();
    await emailInput.fill(email);

    const passwordInput = page.getByTestId('password-input');
    await passwordInput.click();
    await passwordInput.fill(password);

    await page.getByTestId('login-button').click();
}

/**
 * Open the "create account" form from a visible login view and sign up with a new account.
 */
async function signupViaUI(page: Page, { email, password }: { email: string; password: string }) {
    await expect(page.locator('[data-testid="login-view"]')).toBeVisible();
    await page.getByTestId('signup-account-link').click();

    const form = page.locator('form.signup-view');
    await expect(form).toBeVisible();

    await form.getByTestId('email-input').fill(email);
    await form.getByTestId('new-password-input').fill(password);
    await form.getByTestId('confirm-password-input').fill(password);

    // Accept all required policy checkboxes (their amount depends on the configuration).
    // Target the label (default testid of the Checkbox component): the real <input> is
    // visually hidden, check() on the label forwards to it.
    const policies = form.getByTestId('checkbox');
    const count = await policies.count();
    for (let i = 0; i < count; i++) {
        await policies.nth(i).check();
    }

    await page.getByTestId('signup-account-button').click();
}

/**
 * Sign up a brand new organization through the onboarding flow (/aansluiten).
 * This is the same flow as onboarding-organization.spec.ts, but we stop as soon
 * as we reach the verify email view.
 */
async function signupNewOrganizationViaUI(page: Page, { name, email, password }: { name: string; email: string; password: string }) {
    await page.goto(WorkerData.urls.dashboard + '/aansluiten');

    // Step 1: organization details
    await page.getByTestId('organization-type-option').filter({ hasText: 'Jeugd' }).click();
    await page.getByTestId('organization-name-input').fill(name);
    await page.getByTestId('city-only-input').fill('Wetteren');
    await page.getByTestId('country-select').selectOption('BE');
    await page.getByTestId('acquisition-' + AcquisitionType.Recommended).check();
    await page.getByTestId('signup-next-button').click();

    // Step 2: account details
    await page.getByTestId('first-name-input').fill('voornaam');
    await page.getByTestId('last-name-input').fill('achternaam');
    await page.getByTestId('email-input').fill(email);
    await page.getByTestId('password-input').fill(password);
    await page.getByTestId('accept-privacy-input').check();
    await page.getByTestId('accept-terms-input').check();
    await page.getByTestId('accept-data-agreement-input').check();
    await page.getByTestId('signup-account-button').click();
}

/**
 * The scenarios that are identical in all three environments. The context getter is
 * evaluated inside the tests, after the beforeAll hooks of the environment have run.
 */
function defineCommonScenarios(getContext: () => EnvContext) {
    test('after logging in as an unverified user', async ({ page }) => {
        const ctx = getContext();
        const email = randomEmail('verify-login');
        const { user, token, code } = await createUnverifiedUser({ organization: ctx.userOrganization, email });

        await page.goto(ctx.loginUrl);
        await loginViaUI(page, { email, password: PASSWORD });

        await expectVerifyEmailView(page);
        await expectVerifyEmailViewWithToken(page, token);
        await expectVerifyEmailUrl(page, { uriOrganization: ctx.uriOrganization, token, email });

        await fillCode(page, code);
        await expectVerifiedToast(page);
        await expectMemberPortal(page, ctx.memberPortalUrl);
        await expectUserVerified(user.id);
    });

    test('after signing up at an existing organization', async ({ page }) => {
        const ctx = getContext();
        const email = randomEmail('verify-signup');

        await page.goto(ctx.loginUrl);
        await signupViaUI(page, { email, password: PASSWORD });

        await expectVerifyEmailView(page);

        const verificationCode = await getVerificationCode(email);
        await expectVerifyEmailViewWithToken(page, verificationCode.token);

        await expectVerifyEmailUrl(page, { uriOrganization: ctx.uriOrganization, token: verificationCode.token, email });

        await fillCode(page, verificationCode.code);
        await expectVerifiedToast(page);
        await expectMemberPortal(page, ctx.memberPortalUrl);
        await expectUserVerified(verificationCode.userId);
    });

    test('opening the verification link with token and code verifies automatically', async ({ page }) => {
        const ctx = getContext();
        const email = randomEmail('verify-link');
        const { user, token, code } = await createUnverifiedUser({ organization: ctx.userOrganization, email });

        await page.goto(buildVerifyEmailUrl({ domain: ctx.domain, uriOrganization: ctx.uriOrganization, token, email, code }));

        // The code is submitted automatically on load
        await expectVerifiedToast(page);
        await expectMemberPortal(page, ctx.memberPortalUrl);
        await expectUserVerified(user.id);
    });

    test('reloading the verify email page with a token but no code', async ({ page }) => {
        const ctx = getContext();
        const email = randomEmail('verify-reload');
        const { user, token, code } = await createUnverifiedUser({ organization: ctx.userOrganization, email });

        await page.goto(buildVerifyEmailUrl({ domain: ctx.domain, uriOrganization: ctx.uriOrganization, token, email }));

        await expectVerifyEmailView(page);
        await expectVerifyEmailViewWithToken(page, token);

        await checkScopedTo({ page, organization: ctx.scope });
        await expectVerifyEmailUrl(page, { uriOrganization: ctx.uriOrganization, token, email });

        await fillCode(page, code);
        await expectVerifiedToast(page);
        await expectMemberPortal(page, ctx.memberPortalUrl);
        await expectUserVerified(user.id);
    });
}

test.describe('Verify email routing @verify-email', () => {
    const domain = WorkerData.urls.dashboard;

    test.describe('Organization mode', () => {
        let organization: Organization;

        test.beforeAll(async () => {
            TestUtils.setPermanentEnvironment('userMode', 'organization');
            TestUtils.setPermanentEnvironment('singleOrganization', undefined);
            organization = await new OrganizationFactory({
                packages: [STPackageBundle.Webshops, STPackageBundle.Members],
            }).create();
            await STPackageService.updateOrganizationPackages(organization.id);
        });

        test.afterAll(async () => {
            await WorkerData.resetDatabase();
        });

        test.describe('dashboard domain', () => {
            defineCommonScenarios(() => ({
                domain,
                scope: organization,
                uriOrganization: organization,
                userOrganization: organization,
                loginUrl: domain + '/leden/' + organization.uri,
                memberPortalUrl: domain + '/nl-BE/leden/' + organization.uri + '/start',
            }));
        });

        test.describe('registration domain', () => {
            defineCommonScenarios(() => ({
                domain: WorkerData.urls.registration(organization.uri),
                scope: organization,
                uriOrganization: null,
                userOrganization: organization,
                loginUrl: WorkerData.urls.registration(organization.uri) + '/leden',
                memberPortalUrl: WorkerData.urls.registration(organization.uri) + '/nl-BE/leden/start',
            }));
        });

        test('after signing up a new organization', async ({ page }) => {
            const name = 'Vereniging ' + Math.floor(Math.random() * 1_000_000);
            const email = randomEmail('verify-new-org');

            await signupNewOrganizationViaUI(page, { name, email, password: PASSWORD });

            await expectVerifyEmailView(page);

            const newOrganization = await Organization.select().where('name', name).first(true);
            const verificationCode = await getVerificationCode(email);
            await expectVerifyEmailViewWithToken(page, verificationCode.token);

            await expectVerifyEmailUrl(page, { uriOrganization: newOrganization, token: verificationCode.token, email });

            await fillCode(page, verificationCode.code);
            await expectVerifiedToast(page);

            // The user is the full admin of the new organization: the auto app redirects to
            // the dashboard, which starts with the onboarding flow
            await page.locator('.account-switcher').waitFor({ timeout: 20_000 });
            await expect(page.getByTestId('app-name')).toContainText(name);
            await new OnboardingScenario({ page }).assertStartOnboardingPage();

            await expectUserVerified(verificationCode.userId);
        });
    });

    test.describe('Platform mode', () => {
        // In platform mode the verify email route is unscoped.
        test.beforeAll(async () => {
            TestUtils.setPermanentEnvironment('userMode', 'platform');
            TestUtils.setPermanentEnvironment('singleOrganization', undefined);
        });

        test.afterAll(async () => {
            await WorkerData.resetDatabase();
        });

        defineCommonScenarios(() => ({
            domain,
            scope: null,
            uriOrganization: null,
            userOrganization: undefined,
            loginUrl: domain,
            memberPortalUrl: domain + '/nl-BE/leden/start',
        }));
    });

    test.describe('Single organization mode', () => {
        let organization: Organization;

        test.beforeAll(async () => {
            TestUtils.setPermanentEnvironment('userMode', 'platform');
            organization = await new OrganizationFactory({}).create();
            TestUtils.setPermanentEnvironment('singleOrganization', organization.id);
        });

        test.afterAll(async () => {
            await WorkerData.resetDatabase();
        });

        defineCommonScenarios(() => ({
            domain,
            scope: organization,
            // The verify email url does not contain the organization uri: the scope is
            // resolved from the singleOrganization environment
            uriOrganization: null,
            userOrganization: undefined,
            loginUrl: domain + '/leden',
            memberPortalUrl: domain + '/nl-BE/leden/start',
        }));
    });
});
