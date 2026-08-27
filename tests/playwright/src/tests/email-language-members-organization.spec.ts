// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import { EmailMocker } from '@stamhoofd/email';
import type { Organization, User } from '@stamhoofd/models';
import { MemberFactory, Organization as OrganizationModel, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { appToUri, OrganizationEmail, PermissionLevel, Permissions, STPackageBundle, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { Language } from '@stamhoofd/types/Language';
import { TestUtils } from '@stamhoofd/test-utils';
import { TableHelper, WorkerData } from '../helpers/index.js';

// Route emails through the in-process mailer mock so we can read back what each recipient received.
EmailMocker.infect();

/**
 * The dashboard follows the language of the signed-in admin, so the labels used to navigate
 * depend on the language of the sender in each scenario. Hardcoded on purpose
 * (shared/locales/dist/locales/stamhoofd/{nl,fr}-BE.json) so we don't verify $t with $t.
 */
const labels = {
    [Language.Dutch]: {
        more: 'Meer',
        allMembers: 'Alle leden (alle werkjaren)',
        email: 'Bericht sturen',
        sendSettingsTitle: 'Bericht versturen',
        send: 'Versturen',
    },
    [Language.French]: {
        more: 'Plus',
        allMembers: 'Tous les membres (toutes les années associatives)',
        email: 'Envoyer un message',
        sendSettingsTitle: 'Envoyer le message',
        send: 'Envoyer',
    },
} as const;

// The {{greeting}} replacement for a recipient with a first name, per language
const greetings = {
    [Language.Dutch]: (name: string) => `Dag ${name},`,
    [Language.French]: (name: string) => `Bonjour ${name},`,
    [Language.English]: (name: string) => `Hi ${name},`,
} as const;

test.describe('Language of emails sent to members @email-language-members', () => {
    let organization: Organization;
    let admin: User;

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
        TestUtils.setPermanentEnvironment('locales', { BE: [Language.Dutch, Language.French, Language.English] });

        organization = await new OrganizationFactory({
            name: `E-mailtaal ${WorkerData.id}`,
            packages: [STPackageBundle.Members],
        }).create();
        await STPackageService.updateOrganizationPackages(organization.id);

        const refreshed = await OrganizationModel.getByID(organization.id);
        if (!refreshed) {
            throw new Error('Organization not found after creation');
        }
        organization = refreshed;

        // A sender the admin is allowed to send from
        organization.privateMeta.emails.push(OrganizationEmail.create({
            email: `leden-${WorkerData.id}@example.com`,
            name: 'Ledenadministratie',
        }));
        await organization.save();

        admin = await new UserFactory({
            email: `mail-admin-${WorkerData.id}@example.com`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
    });

    test.beforeEach(() => {
        EmailMocker.transactional.reset();
        EmailMocker.broadcast.reset();
    });

    async function createMember({ firstName, email, language }: { firstName: string; email: string; language: Language | null }) {
        const member = await new MemberFactory({
            organization,
            firstName,
            lastName: 'Lid',
        }).create();
        member.details.email = email;
        member.details.language = language;
        await member.save();
        return member;
    }

    async function setLanguages({ organizationLanguage, adminLanguage }: { organizationLanguage: Language | null; adminLanguage: Language | null }) {
        organization.language = organizationLanguage;
        await organization.save();

        admin.language = adminLanguage;
        await admin.save();
    }

    async function setEditorContent(page: Page, text: string) {
        const editor = page.locator('.ProseMirror').first();
        await editor.click();
        await page.keyboard.press('ControlOrMeta+A');
        await page.keyboard.press('Backspace');
        await editor.pressSequentially(text);
        await expect(editor).toContainText(text.split('{{')[0].trim());
    }

    /**
     * Log in as the admin, open the list of all members and send them an email with a
     * {{greeting}} and {{unsubscribeUrl}} replacement. The email itself is not translated:
     * the test is about the language of the recipient replacements.
     */
    async function sendEmailToAllMembers(page: Page, uiLanguage: Language.Dutch | Language.French) {
        const l = labels[uiLanguage];

        const token = await SessionService.createSession(admin);
        const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
        await page.addInitScript(({ organizationId, tokenString }) => {
            window.localStorage.setItem('token-' + organizationId, tokenString);
        }, { organizationId: organization.id, tokenString });

        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}`);

        // The members menu (master pane) is the default view in organization mode
        const membersMenu = page.getByTestId('members-menu');
        await expect(membersMenu).toBeVisible({ timeout: 30_000 });
        await membersMenu.locator('button.menu-button', { hasText: l.more }).click();

        const item = page.getByTestId('context-menu-item-title').filter({ hasText: l.allMembers });
        await expect(item).toBeVisible();
        await item.click();

        const table = new TableHelper(page);
        await table.waitForFirstRow();
        await table.toggleSelectAllRows();
        await table.clickAction(l.email);

        const subject = page.locator('#mail-subject');
        await expect(subject).toBeVisible();
        await subject.fill('Onderwerp');
        await setEditorContent(page, 'Inhoud {{greeting}} {{unsubscribeUrl}}');

        // Scope to the editor form (the members view behind it has its own search form)
        const editorForm = page.locator('form').filter({ has: subject }).first();
        await editorForm.evaluate((form: HTMLFormElement) => form.requestSubmit());

        // Member emails have extra send settings (show in member portal / send as email): confirm those first
        const sendSettings = page.locator('.st-view', { has: page.locator('h1', { hasText: l.sendSettingsTitle }) }).last();
        await expect(sendSettings).toBeVisible();
        await sendSettings.getByRole('button', { name: l.send }).click();

        const confirm = page.getByTestId('centered-message');
        await expect(confirm).toBeVisible();
        await confirm.getByRole('button', { name: l.send }).click();
    }

    /** The members created by the factory also have parents with an email address: only look at the member's own email */
    async function waitForEmailTo(email: string) {
        await expect.poll(async () => (await EmailMocker.getSucceededEmails()).some(e => e.to.includes(email)), { timeout: 20_000 }).toBe(true);
        return (await EmailMocker.getSucceededEmails()).find(e => e.to.includes(email))!;
    }

    test('a member without a language receives the email in the organization language, not in the language of the sender', async ({ browser }) => {
        test.setTimeout(120_000);
        await setLanguages({ organizationLanguage: Language.Dutch, adminLanguage: Language.French });
        const email = `nl-lid-${WorkerData.id}@example.com`;
        await createMember({ firstName: 'Niels', email, language: null });

        // The admin uses the dashboard in French
        const context = await browser.newContext({ locale: 'fr-BE' });
        const page = await context.newPage();

        try {
            await sendEmailToAllMembers(page, Language.French);
            const sent = await waitForEmailTo(email);
            expect(sent.subject).toBe('Onderwerp');
            expect(sent.html).toContain('Inhoud');

            // The replacements are Dutch (organization language), not French (sender language)
            expect(sent.html).toContain(greetings[Language.Dutch]('Niels'));
            expect(sent.html).not.toContain(greetings[Language.French]('Niels'));
            expect(sent.html).not.toContain(greetings[Language.English]('Niels'));
            expect(sent.html).toContain('/nl-BE/unsubscribe');
        } finally {
            await context.close();
        }
    });

    test('a French member receives the email in French, even when the organization is English and the sender is Dutch', async ({ browser }) => {
        test.setTimeout(120_000);
        await setLanguages({ organizationLanguage: Language.English, adminLanguage: Language.Dutch });
        const email = `fr-lid-${WorkerData.id}@example.com`;
        await createMember({ firstName: 'Fabien', email, language: Language.French });

        // The admin uses the dashboard in Dutch
        const context = await browser.newContext({ locale: 'nl-BE' });
        const page = await context.newPage();

        try {
            await sendEmailToAllMembers(page, Language.Dutch);
            const sent = await waitForEmailTo(email);

            expect(sent.subject).toBe('Onderwerp');
            expect(sent.html).toContain('Inhoud');

            // The replacements are French (member language), not English (organization) nor Dutch (sender)
            expect(sent.html).toContain(greetings[Language.French]('Fabien'));
            expect(sent.html).not.toContain(greetings[Language.English]('Fabien'));
            expect(sent.html).not.toContain(greetings[Language.Dutch]('Fabien'));
            expect(sent.html).toContain('/fr-BE/unsubscribe');
        } finally {
            await context.close();
        }
    });
});
