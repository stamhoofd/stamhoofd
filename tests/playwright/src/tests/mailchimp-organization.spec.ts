// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import { STPackageService } from '@stamhoofd/backend/services/STPackageService';
import { MailchimpMocker } from '@stamhoofd/backend/tests/helpers/MailchimpMocker';
import type { User } from '@stamhoofd/models';
import { GroupFactory, MemberFactory, OrganizationFactory, RegistrationFactory, UserFactory } from '@stamhoofd/models';
import { appToUri, MemberDetails, Parent, PermissionLevel, Permissions, STPackageBundle, Token as TokenStruct, TranslatedString, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await SessionService.createSession(user);
    const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
    const organizationId = user.organizationId;
    await page.addInitScript(({ organizationId, tokenString }) => {
        window.localStorage.setItem('token-' + organizationId, tokenString);
    }, { organizationId, tokenString });
}

async function selectTab(page: Page, tabId: string) {
    await expect(page.locator('[data-testid="tab-button"]:visible').first()).toBeVisible();
    const directTab = page.locator(`[data-testid="tab-button"][data-tab-id="${tabId}"]:visible`).first();
    if (await directTab.count() > 0) {
        await directTab.click();
        return;
    }
    await page.locator('[data-testid="tab-button"][data-tab-id="more"]:visible').first().click();
    await page.locator(`[data-testid="tab-dropdown-item"][data-tab-id="${tabId}"]:visible`).first().click();
}

function activePopup(page: Page) {
    return page.locator('div.popup.focused').last();
}

test.describe('Mailchimp @mailchimp', () => {
    let mailchimp: MailchimpMocker;

    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
        TestUtils.setPermanentEnvironment('singleOrganization', undefined);
    });

    test.beforeEach(() => {
        mailchimp = new MailchimpMocker();
        mailchimp.addList('list1', 'Nieuwsbrief Scouts Gent', [{ email: 'oud-lid@example.com', tags: ['Stamhoofd: Lid'] }]);
        mailchimp.start();
    });

    test.afterEach(() => {
        mailchimp.stop();
    });

    test.afterAll(async () => {
        await WorkerData.resetDatabase();
    });

    test('an administrator connects Mailchimp and synchronises all members', async ({ page }) => {
        const organization = await new OrganizationFactory({ packages: [STPackageBundle.Members] }).create();
        await STPackageService.updateOrganizationPackages(organization.id);
        await organization.refresh();
        organization.privateMeta.featureFlags = ['mailchimp'];
        await organization.save();

        const admin = await new UserFactory({
            organization,
            email: `mailchimp-${Math.random().toString(36).slice(2)}@example.com`,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        const group = await new GroupFactory({ organization, name: TranslatedString.create('Welpen') }).create();
        const member = await new MemberFactory({
            organization,
            details: MemberDetails.create({
                firstName: 'Emma',
                lastName: 'Peeters',
                email: 'emma@example.com',
                parents: [Parent.create({ firstName: 'An', lastName: 'Peeters', email: 'an@example.com' })],
            }),
        }).create();
        await new RegistrationFactory({ member, group }).create();

        await loginAs({ page, user: admin });
        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}`);

        await selectTab(page, 'settings');
        await page.getByTestId('open-mailchimp-settings').click();

        // Connect
        await activePopup(page).getByTestId('mailchimp-api-key').click();
        await activePopup(page).locator('input[type="password"]').fill(mailchimp.apiKey);
        await activePopup(page).getByRole('button', { name: 'Koppelen' }).click();
        await expect(activePopup(page).getByTestId('mailchimp-api-key')).toContainText('Scouts Gent');

        // Choose the audience
        await activePopup(page).getByTestId('mailchimp-audience').click();
        await activePopup(page).getByText('Nieuwsbrief Scouts Gent').click();
        await activePopup(page).getByRole('button', { name: 'Opslaan' }).click();
        await expect(activePopup(page).getByTestId('mailchimp-audience')).toContainText('Nieuwsbrief Scouts Gent');

        // Synchronise
        await activePopup(page).getByTestId('mailchimp-sync-all-members').click();
        await expect(activePopup(page).getByTestId('mailchimp-sync-preview')).toContainText('2 e-mailadressen');
        await activePopup(page).getByTestId('mailchimp-confirm-consent').click();
        await activePopup(page).getByRole('button', { name: 'Synchroniseren' }).click();

        const result = activePopup(page).getByTestId('mailchimp-sync-result-view');
        await expect(result).toContainText('Synchronisatie voltooid', { timeout: 20_000 });
        await expect(result.getByTestId('mailchimp-sync-stats')).toContainText(/2\s*Toegevoegd/);
        await expect(result.getByTestId('mailchimp-sync-stats')).toContainText(/1\s*Niet meer ingeschreven/);

        expect(mailchimp.getMember('list1', 'an@example.com')).toMatchObject({
            status: 'subscribed',
            mergeFields: { FNAME: 'An', LNAME: 'Peeters', SH_LEDEN: 'Emma', SH_GROEPEN: 'Welpen' },
        });
        expect(mailchimp.getMember('list1', 'emma@example.com')?.tags).toContain('Stamhoofd: Groep – Welpen');
        expect(mailchimp.getMember('list1', 'oud-lid@example.com')?.tags).toEqual(['Stamhoofd: Niet meer ingeschreven']);
    });
});
