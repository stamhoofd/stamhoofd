// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import type { Organization } from '@stamhoofd/models';
import { OrganizationFactory, User, UserFactory } from '@stamhoofd/models';
import { STPackageBundle, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { Language } from '@stamhoofd/types/Language';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

const PASSWORD = 'testAbc123456';

test.describe('Registration portal language of an organization @portal-language', () => {
    let organization: Organization;
    let user: User;
    let registrationUrl: string;

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
        TestUtils.setPermanentEnvironment('locales', { BE: [Language.Dutch, Language.French, Language.English] });

        organization = await new OrganizationFactory({
            name: `Portail ${WorkerData.id}`,
            packages: [STPackageBundle.Members],
        }).create();
        await STPackageService.updateOrganizationPackages(organization.id);
        await organization.refresh();

        organization.language = Language.French;
        await organization.save();

        // No preferred language yet: the portal has to fall back to the organization language
        user = await new UserFactory({
            organization,
            email: `portal-language-${WorkerData.id}@example.com`,
            password: PASSWORD,
        }).create();

        registrationUrl = WorkerData.urls.registration(organization.uri) + '/leden';
    });

    async function login(page: Page) {
        await page.getByTestId('open-login-button').click();

        const emailInput = page.getByTestId('email-input');
        await expect(emailInput).toBeVisible();
        await emailInput.fill(user.email);
        await expect(emailInput).toHaveValue(user.email);

        const passwordInput = page.getByTestId('password-input');
        await passwordInput.fill(PASSWORD);
        await expect(passwordInput).toHaveValue(PASSWORD);

        await page.getByTestId('login-button').click();
        await expect(page.getByTestId('members-start-view')).toBeVisible({ timeout: 30_000 });
    }

    /** Sign in by injecting a token, so a fresh context is signed in on its very first page load */
    async function injectToken(context: BrowserContext) {
        const token = await SessionService.createSession(user);
        const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
        await context.addInitScript(({ organizationId, tokenString }) => {
            window.localStorage.setItem('token-' + organizationId, tokenString);
        }, { organizationId: organization.id, tokenString });
    }

    /** Account view > 'Change language' row > language (a context menu with the native names) */
    async function switchLanguage(page: Page, { changeLanguageLabel, nativeName }: { changeLanguageLabel: string; nativeName: string }) {
        await page.locator('.account-switcher').click();
        await page.locator('.st-list-item', { hasText: changeLanguageLabel }).first().click();

        const item = page.getByTestId('context-menu-item-title').filter({ hasText: nativeName });
        await expect(item).toBeVisible();
        await item.click();
    }

    test('an English browser sees the portal in French, and a language switch is remembered on the account', async ({ browser }) => {
        test.setTimeout(120_000);
        const context = await browser.newContext({ locale: 'en-US' });
        const page = await context.newPage();

        try {
            // First visit: the browser language (English) is ignored, the organization language wins.
            // The texts are hardcoded on purpose (shared/locales/dist/locales/stamhoofd/{fr,en}-BE.json)
            // so we don't verify $t with the same $t machinery we're testing.
            await page.goto(registrationUrl);
            const homeView = page.getByTestId('members-home-view');
            await expect(homeView).toBeVisible({ timeout: 30_000 });
            await expect(homeView.locator('h1').first()).toHaveText(`S'inscrire chez ${organization.name}`);

            await login(page);
            const startView = page.getByTestId('members-start-view');
            await expect(startView.locator('h1').first()).toHaveText('Portail des membres');

            // The account view lets the user switch to English
            await switchLanguage(page, { changeLanguageLabel: 'Changer de langue', nativeName: 'English' });
            await expect(page.locator('.st-list-item', { hasText: 'Change language' }).first()).toBeVisible();

            // The preference is stored on the account, not only in this browser
            await expect.poll(async () => (await User.getByID(user.id))?.language).toBe(Language.English);

            // A reload (without locale in the url) keeps English
            await page.goto(registrationUrl);
            await expect(page.getByTestId('members-start-view').locator('h1').first()).toHaveText('Member portal', { timeout: 30_000 });
            await expect(page.getByText('Portail des membres')).toHaveCount(0);
        } finally {
            await context.close();
        }

        // A brand new browser (no stored locale) that is signed in as the same user also gets English,
        // even though the organization language is still French
        const freshContext = await browser.newContext({ locale: 'en-US' });
        const freshPage = await freshContext.newPage();
        try {
            await injectToken(freshContext);
            await freshPage.goto(registrationUrl);
            await expect(freshPage.getByTestId('members-start-view').locator('h1').first()).toHaveText('Member portal', { timeout: 30_000 });
            await expect(freshPage.getByText('Portail des membres')).toHaveCount(0);
        } finally {
            await freshContext.close();
        }
    });
});
