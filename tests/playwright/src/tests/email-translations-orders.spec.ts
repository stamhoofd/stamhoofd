// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { EmailMocker } from '@stamhoofd/email';
import type { Organization, User, Webshop } from '@stamhoofd/models';
import { OrderFactory, Organization as OrganizationModel, OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { OrganizationEmail, PermissionLevel, Permissions, STPackageBundle, Token as TokenStruct, Version, WebshopTicketType } from '@stamhoofd/structures';
import { Language } from '@stamhoofd/types/Language';
import { TestUtils } from '@stamhoofd/test-utils';
import { DashboardPage, DashboardTab, TableHelper, WorkerData } from '../helpers/index.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

// Route emails through the in-process mailer mock so we can read back what each recipient received.
EmailMocker.infect();

test.describe('Translated emails to webshop orders @translated-order-email', () => {
    let organization: Organization;
    let admin: User;
    let webshop: Webshop;

    const orders = [
        { language: Language.Dutch, firstName: 'Niels', email: `nl-order-${WorkerData.id}@example.com` },
        { language: Language.French, firstName: 'Fabien', email: `fr-order-${WorkerData.id}@example.com` },
        { language: Language.English, firstName: 'Emily', email: `en-order-${WorkerData.id}@example.com` },
    ] as const;

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
        // Three languages are needed for a default + two translations
        TestUtils.setPermanentEnvironment('locales', { BE: [Language.Dutch, Language.French, Language.English] });

        organization = await new OrganizationFactory({
            name: `Vertaalde e-mails ${WorkerData.id}`,
            packages: [STPackageBundle.Webshops],
        }).create();
        await STPackageService.updateOrganizationPackages(organization.id);

        const refreshed = await OrganizationModel.getByID(organization.id);
        if (!refreshed) {
            throw new Error('Organization not found after creation');
        }
        organization = refreshed;

        // A sender the admin is allowed to send from (needed for the send flow)
        organization.privateMeta.emails.push(OrganizationEmail.create({
            email: `shop-${WorkerData.id}@example.com`,
            name: 'Webshop',
        }));
        // The translation UI is hidden behind a feature flag by default
        organization.privateMeta.featureFlags = ['email-translations'];
        await organization.save();

        admin = await new UserFactory({
            email: `mail-admin-${WorkerData.id}@example.com`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        const created = await TestWebshops.create({
            organization,
            name: `Vertaalshop ${WorkerData.id}`,
            ticketType: WebshopTicketType.None,
            productCount: 1,
            cartEnabled: false,
        });
        webshop = created.webshop;

        // One order per consumer language
        for (const order of orders) {
            const model = await new OrderFactory({
                webshop,
                firstName: order.firstName,
                lastName: 'Klant',
                email: order.email,
            }).create();
            model.consumerLanguage = order.language;
            await model.save();
        }
    });

    async function setEditorContent(page: Page, text: string) {
        const editor = page.locator('.ProseMirror').first();
        await editor.click();
        await page.keyboard.press('ControlOrMeta+A');
        await page.keyboard.press('Backspace');
        await editor.pressSequentially(text);
        // The body before the {{...}} placeholder is language specific: assert that part landed
        await expect(editor).toContainText(text.split('{{')[0].trim());
    }

    async function openLanguageMenu(page: Page) {
        await page.getByTestId('email-language-button').click();
        const menu = page.locator('.context-menu-container:visible').last();
        await expect(menu.locator('.context-menu-item').first()).toBeVisible();
        return menu;
    }

    /**
     * Hover a language-menu item that has a child menu and wait until the child menu opened
     * (child menus open on hover; clicking the parent item does nothing on desktop).
     */
    async function openLanguageChildMenu(page: Page, parentName: string) {
        const containers = page.locator('.context-menu-container:visible');
        const menu = await openLanguageMenu(page);
        const count = await containers.count();
        await menu.locator('.context-menu-item', { hasText: parentName }).first().hover();
        await expect(containers).toHaveCount(count + 1);
        const child = containers.last();
        await expect(child.locator('.context-menu-item').first()).toBeVisible();
        return child;
    }

    /**
     * Wait until a language switch actually completed. Switching is async (it flushes the editor
     * first), so without this wait a following subject/body edit could still land on the previous
     * language and corrupt it. The button shows the name of the language that is being edited.
     */
    async function expectCurrentLanguage(page: Page, name: string) {
        await expect(page.getByTestId('email-language-button')).toContainText(name);
    }

    /** Mark the untranslated content as its first language: 'Instellen als' > language */
    async function setFirstLanguage(page: Page, name: string) {
        const child = await openLanguageChildMenu(page, 'Instellen als');
        await child.locator('.context-menu-item', { hasText: name }).first().click();
        await expectCurrentLanguage(page, name);
    }

    /** Add a translation, seeded from the displayed content: 'Vertaling toevoegen' > language */
    async function addTranslation(page: Page, name: string) {
        const child = await openLanguageChildMenu(page, 'Vertaling toevoegen');
        await child.locator('.context-menu-item', { hasText: name }).first().click();
        await expectCurrentLanguage(page, name);
    }

    /** Switch to an existing language (a top-level menu item) */
    async function switchToLanguage(page: Page, name: string) {
        const menu = await openLanguageMenu(page);
        await menu.locator('.context-menu-item', { hasText: name }).first().click();
        await expectCurrentLanguage(page, name);
    }

    /** Log in by injecting the admin token and open the email composer for all orders of the webshop */
    async function openComposerForAllOrders(page: Page) {
        const token = await Token.createToken(admin);
        const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
        await page.addInitScript(({ organizationId, tokenString }) => {
            window.localStorage.setItem('token-' + organizationId, tokenString);
        }, { organizationId: organization.id, tokenString });

        const dashboard = new DashboardPage(page);
        await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
        await dashboard.openTab(DashboardTab.Webshops);
        await page.getByTestId('webshop-menu-item').filter({ hasText: webshop.meta.name }).click();
        await page.getByTestId('open-orders-button').click();

        const table = new TableHelper(page);
        await table.waitForFirstRow();
        await table.toggleSelectAllRows();
        await table.clickAction('E-mailen');

        await expect(page.locator('#mail-subject')).toBeVisible();
    }

    test('each order receives the email in its own language, with the default as fallback', async ({ browser }) => {
        // Keep the dashboard in Dutch even though English is an available language (the browser
        // default of Playwright is English, which would otherwise switch the dashboard to English)
        const context = await browser.newContext({ locale: 'nl-BE' });
        const page = await context.newPage();

        try {
            // Compose a new email: Dutch as the default language + a French translation.
            // No English translation is added: the English order tests the fallback.
            await openComposerForAllOrders(page);
            const subject = page.locator('#mail-subject');

            // The {{orderTable}} replacement renders a per-recipient order table whose column titles
            // are localized, so we can also assert that recipient replacements are translated.
            await subject.fill('Nederlands onderwerp');
            await setEditorContent(page, 'Nederlandse inhoud {{orderTable}} {{unsubscribeUrl}}');

            // Selecting the first language marks the existing content as Dutch
            await setFirstLanguage(page, 'Nederlands');
            await expect(subject).toHaveValue('Nederlands onderwerp');

            await addTranslation(page, 'Frans');
            await expect(subject).toHaveValue('Nederlands onderwerp'); // seeded from the default content
            await subject.fill('Sujet français');
            await setEditorContent(page, 'Contenu français {{orderTable}} {{unsubscribeUrl}}');

            // Send it and confirm. Scope to the editor form (the orders view behind it has its own
            // search form, so `form.first()` on the page would submit the wrong one).
            const editorForm = page.locator('form').filter({ has: page.locator('#mail-subject') }).first();
            await editorForm.evaluate((form: HTMLFormElement) => form.requestSubmit());
            const confirm = page.getByTestId('centered-message');
            await expect(confirm).toBeVisible();
            await confirm.getByRole('button', { name: 'Versturen' }).click();

            // Each recipient should get the content of its own language (Dutch/French), or the
            // default content when there is no translation for its language (English)
            await expect.poll(async () => (await EmailMocker.getSucceededEmails()).length, { timeout: 20_000 }).toBe(3);
            const emails = await EmailMocker.getSucceededEmails();

            const dutch = emails.find(e => e.to.includes(orders[0].email))!;
            const french = emails.find(e => e.to.includes(orders[1].email))!;
            const english = emails.find(e => e.to.includes(orders[2].email))!;

            // Dutch is the default language: its content lives in the default content columns
            expect(dutch).toBeDefined();
            expect(dutch.subject).toBe('Nederlands onderwerp');
            expect(dutch.html).toContain('Nederlandse inhoud');

            expect(french).toBeDefined();
            expect(french.subject).toBe('Sujet français');
            expect(french.html).toContain('Contenu français');

            // English has no translation: falls back to the default (Dutch) content
            expect(english).toBeDefined();
            expect(english.subject).toBe('Nederlands onderwerp');
            expect(english.html).toContain('Nederlandse inhoud');

            // No cross-language leakage
            expect(french.html).not.toContain('Nederlandse inhoud');
            expect(dutch.html).not.toContain('Contenu français');
            expect(english.html).not.toContain('Contenu français');

            // The recipient replacements are localized too: the order-table column titles
            // ('Artikel' / 'Aantal') are rendered in each recipient's own language,
            // independently of the selected content language
            expect(dutch.html).toContain('Artikel');
            expect(dutch.html).toContain('Aantal');

            expect(french.html).toContain('Article');
            expect(french.html).toContain('Nombre');
            expect(french.html).not.toContain('Artikel');

            // The English order gets the Dutch content, but its replacements stay English
            expect(english.html).toContain('Item');
            expect(english.html).toContain('Amount');
            expect(english.html).not.toContain('Artikel');
        } finally {
            await context.close();
        }
    });

    test('the composer shows the example values in the language that is being edited', async ({ browser }) => {
        // Keep the dashboard in Dutch (see above)
        const context = await browser.newContext({ locale: 'nl-BE' });
        const page = await context.newPage();

        try {
            await openComposerForAllOrders(page);

            // Typing {{greeting}} inserts a smart variable chip that shows the greeting of the
            // example recipient. The greeting translations ('Dag' nl / 'Bonjour' fr, see
            // shared/locales/dist/locales/digit/{nl,fr}-BE.json) are hardcoded on purpose so we
            // don't verify $t with the same $t machinery we're testing.
            const editor = page.locator('.ProseMirror').first();
            await editor.click();
            await editor.pressSequentially('Inhoud {{greeting}}');
            const chip = page.locator('.ProseMirror span[data-type="smartVariable"]');

            await setFirstLanguage(page, 'Nederlands');
            await expect(chip).toContainText('Dag');

            // The French translation shows the French example values, even though the example
            // recipient itself received/receives the email in its own language
            await addTranslation(page, 'Frans');
            await expect(chip).toContainText('Bonjour');
            await expect(chip).not.toContainText('Dag');

            // And back
            await switchToLanguage(page, 'Nederlands');
            await expect(chip).toContainText('Dag');
            await expect(chip).not.toContainText('Bonjour');
        } finally {
            await context.close();
        }
    });
});
