// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import { Platform, User, UserFactory } from '@stamhoofd/models';
import { Token as TokenStruct, Version } from '@stamhoofd/structures';
import { Language } from '@stamhoofd/types/Language';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

test.describe('Member portal language of a platform @portal-language', () => {
    let user: User;
    const portalUrl = () => `${WorkerData.urls.dashboard}/leden`;

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');
        TestUtils.setPermanentEnvironment('locales', { BE: [Language.Dutch, Language.French, Language.English] });

        // The tenant is English only by default
        const platform = await Platform.getForEditing();
        platform.language = Language.English;
        await platform.save();

        // No preferred language yet: the portal has to fall back to the tenant language
        user = await new UserFactory({
            firstName: 'Marie',
            lastName: 'Dupont',
            email: `portal-language-${WorkerData.id}@example.com`,
        }).create();
    });

    test.afterAll(async () => {
        const platform = await Platform.getForEditing();
        platform.language = null;
        await platform.save();
    });

    /** Sign in by injecting a token, so the context is signed in on its very first page load */
    async function injectToken(context: BrowserContext) {
        const token = await SessionService.createSession(user);
        const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
        await context.addInitScript((tokenString) => {
            window.localStorage.setItem('token-platform', tokenString);
        }, tokenString);
    }

    /** Account view > 'Change language' row > language (a context menu with the native names) */
    async function switchLanguage(page: Page, { changeLanguageLabel, nativeName }: { changeLanguageLabel: string; nativeName: string }) {
        await page.locator('.account-switcher').click();
        await page.locator('.st-list-item', { hasText: changeLanguageLabel }).first().click();

        const item = page.getByTestId('context-menu-item-title').filter({ hasText: nativeName });
        await expect(item).toBeVisible();
        await item.click();
    }

    test('a French browser sees the login page in English when the tenant language is English', async ({ browser }) => {
        const context = await browser.newContext({ locale: 'fr-BE' });
        const page = await context.newPage();

        try {
            // The texts are hardcoded on purpose (shared/locales/dist/locales/stamhoofd/{fr,en}-BE.json)
            // so we don't verify $t with the same $t machinery we're testing.
            await page.goto(portalUrl());
            const loginView = page.getByTestId('login-view');
            await expect(loginView).toBeVisible({ timeout: 30_000 });
            await expect(loginView.locator('h1').first()).toHaveText('Login');
            await expect(loginView.locator('h1', { hasText: 'Connexion' })).toHaveCount(0);
        } finally {
            await context.close();
        }
    });

    test('a French browser sees the portal in English, and a language switch to French is remembered on the account', async ({ browser }) => {
        test.setTimeout(120_000);
        const context = await browser.newContext({ locale: 'fr-BE' });
        const page = await context.newPage();

        try {
            await injectToken(context);
            await page.goto(portalUrl());
            const startView = page.getByTestId('members-start-view');
            await expect(startView).toBeVisible({ timeout: 30_000 });
            await expect(startView.locator('h1').first()).toHaveText('Member portal');

            // The account view lets the user switch to French
            await switchLanguage(page, { changeLanguageLabel: 'Change language', nativeName: 'Français' });
            await expect(page.locator('.st-list-item', { hasText: 'Changer de langue' }).first()).toBeVisible();

            // The preference is stored on the account, not only in this browser
            await expect.poll(async () => (await User.getByID(user.id))?.language).toBe(Language.French);

            // A reload (without locale in the url) keeps French
            await page.goto(portalUrl());
            await expect(page.getByTestId('members-start-view').locator('h1').first()).toHaveText('Portail des membres', { timeout: 30_000 });
            await expect(page.getByText('Member portal')).toHaveCount(0);
        } finally {
            await context.close();
        }

        // A brand new browser (no stored locale) that is signed in as the same user also gets French,
        // even though the tenant language is still English
        const freshContext = await browser.newContext({ locale: 'fr-BE' });
        const freshPage = await freshContext.newPage();
        try {
            await injectToken(freshContext);
            await freshPage.goto(portalUrl());
            await expect(freshPage.getByTestId('members-start-view').locator('h1').first()).toHaveText('Portail des membres', { timeout: 30_000 });
            await expect(freshPage.getByText('Member portal')).toHaveCount(0);
        } finally {
            await freshContext.close();
        }
    });
});
