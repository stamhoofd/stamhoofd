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

    /**
     * Add + switch to a translation via the language button, then wait until the switch actually
     * completed. Switching is async (it flushes the editor first), so without this wait a following
     * subject/body edit could still land on the previous language and corrupt it.
     */
    async function switchToLanguage(page: Page, menuName: string, tag: string) {
        await page.getByTestId('email-language-button').click();
        const menu = page.locator('.context-menu-container:visible').last();
        await expect(menu.locator('.context-menu-item').first()).toBeVisible();
        await menu.locator('.context-menu-item', { hasText: menuName }).first().click();
        // The language button shows the active language as a tag once the switch is done
        await expect(page.getByTestId('email-language-button')).toContainText(tag);
    }

    test('each order receives the email in its own language, with the default as fallback', async ({ browser }) => {
        // Keep the dashboard in Dutch even though English is an available language (the browser
        // default of Playwright is English, which would otherwise switch the dashboard to English)
        const context = await browser.newContext({ locale: 'nl-BE' });
        const page = await context.newPage();

        try {
            // Log in by injecting the admin token (the order flow itself is not what we test here)
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

            // Compose a new email: default content + a French and an English translation
            const subject = page.locator('#mail-subject');
            await expect(subject).toBeVisible();

            // The {{orderTable}} replacement renders a per-recipient order table whose column titles
            // are localized, so we can also assert that recipient replacements are translated.
            await subject.fill('Nederlands onderwerp');
            await setEditorContent(page, 'Nederlandse inhoud {{orderTable}} {{unsubscribeUrl}}');

            await switchToLanguage(page, 'Frans', 'FR');
            await expect(subject).toHaveValue('Nederlands onderwerp'); // seeded from the default content
            await subject.fill('Sujet français');
            await setEditorContent(page, 'Contenu français {{orderTable}} {{unsubscribeUrl}}');

            await switchToLanguage(page, 'Engels', 'EN');
            await subject.fill('English subject');
            await setEditorContent(page, 'English content {{orderTable}} {{unsubscribeUrl}}');

            // Send it and confirm. Scope to the editor form (the orders view behind it has its own
            // search form, so `form.first()` on the page would submit the wrong one).
            const editorForm = page.locator('form').filter({ has: page.locator('#mail-subject') }).first();
            await editorForm.evaluate((form: HTMLFormElement) => form.requestSubmit());
            const confirm = page.getByTestId('centered-message');
            await expect(confirm).toBeVisible();
            await confirm.getByRole('button', { name: 'Versturen' }).click();

            // Each recipient should get the content of its own language (French/English), or the
            // default content when there is no translation for its language (Dutch)
            await expect.poll(async () => (await EmailMocker.getSucceededEmails()).length, { timeout: 20_000 }).toBe(3);
            const emails = await EmailMocker.getSucceededEmails();

            const dutch = emails.find(e => e.to.includes(orders[0].email))!;
            const french = emails.find(e => e.to.includes(orders[1].email))!;
            const english = emails.find(e => e.to.includes(orders[2].email))!;

            expect(dutch).toBeDefined();
            expect(dutch.subject).toBe('Nederlands onderwerp');
            expect(dutch.html).toContain('Nederlandse inhoud');

            expect(french).toBeDefined();
            expect(french.subject).toBe('Sujet français');
            expect(french.html).toContain('Contenu français');

            expect(english).toBeDefined();
            expect(english.subject).toBe('English subject');
            expect(english.html).toContain('English content');

            // No cross-language leakage
            expect(french.html).not.toContain('Nederlandse inhoud');
            expect(french.html).not.toContain('English content');
            expect(english.html).not.toContain('Contenu français');

            // The recipient replacements are localized too: the order-table column titles
            // ('Artikel' / 'Aantal') are rendered in each recipient's own language
            expect(dutch.html).toContain('Artikel');
            expect(dutch.html).toContain('Aantal');

            expect(french.html).toContain('Article');
            expect(french.html).toContain('Nombre');
            expect(french.html).not.toContain('Artikel');

            expect(english.html).toContain('Item');
            expect(english.html).toContain('Amount');
            expect(english.html).not.toContain('Artikel');
        } finally {
            await context.close();
        }
    });
});
