// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { Organization, User } from '@stamhoofd/models';
import { Email, EmailRecipient, MemberFactory, OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { EmailContent, EmailStatus, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { Language } from '@stamhoofd/types/Language';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

test.describe('Member portal emails @member-portal-emails', () => {
    let organization: Organization;
    let user: User;

    test.beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');
        TestUtils.setPermanentEnvironment('locales', { BE: [Language.Dutch, Language.French] });

        organization = await new OrganizationFactory({
            name: `Ledenportaal e-mails ${WorkerData.id}`,
        }).create();

        user = await new UserFactory({
            firstName: 'Marie',
            lastName: 'Dupont',
            email: `member-emails-${WorkerData.id}@example.com`,
        }).create();

        const member = await new MemberFactory({
            firstName: 'Marie',
            lastName: 'Dupont',
            user,
        }).create();

        // A sent email with a Dutch default content and a French translation. The {{greeting}}
        // proves the replacements are regenerated in the language of the displayed content.
        const email = new Email();
        email.subject = 'Nederlands onderwerp';
        email.status = EmailStatus.Sent;
        email.text = 'Nederlandse inhoud';
        email.html = '<p>{{greeting}} Nederlandse inhoud</p>';
        email.json = {};
        email.language = Language.Dutch;
        email.translations = new Map([
            [Language.French, EmailContent.create({
                subject: 'Sujet français',
                html: '<p>{{greeting}} Contenu français</p>',
                text: 'Contenu français',
            })],
        ]);
        email.organizationId = organization.id;
        email.showInMemberPortal = true;
        email.sentAt = new Date();
        await email.save();

        // The member received the email in Dutch
        const recipient = new EmailRecipient();
        recipient.emailId = email.id;
        recipient.memberId = member.id;
        recipient.userId = user.id;
        recipient.email = user.email;
        recipient.firstName = 'Marie';
        recipient.lastName = 'Dupont';
        recipient.language = Language.Dutch;
        recipient.sentAt = new Date();
        await recipient.save();
    });

    /**
     * Open the member portal in a browser context with the given locale (the portal follows the
     * browser language) and navigate to the email list
     */
    async function openMemberPortalEmails(page: Page) {
        const token = await Token.createToken(user);
        const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
        await page.addInitScript((tokenString) => {
            window.localStorage.setItem('token-platform', tokenString);
        }, tokenString);

        await page.goto(`${WorkerData.urls.dashboard}/leden`);
        await page.locator('[data-testid="tab-button"][data-tab-id="communication"]:visible').first().click();
    }

    function emailBody(page: Page) {
        // The email content is rendered inside a sandboxed iframe
        return page.frameLocator('.email-preview-box iframe').locator('body');
    }

    test('the member sees the email in the language of the portal when a translation exists', async ({ browser }) => {
        // The member received the email in Dutch, but views the portal in French.
        // The web greeting translations ('Beste,' nl / 'Bonjour,' fr, see
        // shared/locales/dist/locales/digit/{nl,fr}-BE.json) are hardcoded on purpose so we
        // don't verify $t with the same $t machinery we're testing.
        const context = await browser.newContext({ locale: 'fr-BE' });
        const page = await context.newPage();

        try {
            await openMemberPortalEmails(page);

            // The list shows the French subject
            await expect(page.getByText('Sujet français')).toBeVisible();
            await expect(page.getByText('Nederlands onderwerp')).toHaveCount(0);
            await page.getByText('Sujet français').first().click();

            // The email itself shows the French content with the French replacements
            // (the subject is shown in the navigation bar and as the page title)
            await expect(page.locator('main h1', { hasText: 'Sujet français' })).toBeVisible();
            await expect(emailBody(page)).toContainText('Bonjour, Contenu français');
            await expect(emailBody(page)).not.toContainText('Nederlandse inhoud');
            await expect(emailBody(page)).not.toContainText('Beste,');
        } finally {
            await context.close();
        }
    });

    test('the member sees the email in the default language when viewing the portal in that language', async ({ browser }) => {
        const context = await browser.newContext({ locale: 'nl-BE' });
        const page = await context.newPage();

        try {
            await openMemberPortalEmails(page);

            await expect(page.getByText('Nederlands onderwerp')).toBeVisible();
            await expect(page.getByText('Sujet français')).toHaveCount(0);
            await page.getByText('Nederlands onderwerp').first().click();

            await expect(page.locator('main h1', { hasText: 'Nederlands onderwerp' })).toBeVisible();
            await expect(emailBody(page)).toContainText('Beste, Nederlandse inhoud');
            await expect(emailBody(page)).not.toContainText('Contenu français');
            await expect(emailBody(page)).not.toContainText('Bonjour,');
        } finally {
            await context.close();
        }
    });
});
