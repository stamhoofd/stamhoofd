// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import { belcotaxRepresentatives, ssoUserPassword } from '@stamhoofd/cli';
import type { DocumentTemplate, Organization, User } from '@stamhoofd/models';
import { BelcotaxConnection, BelcotaxSubmission, Document, DocumentTemplateFactory, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import type { RecordAnswer } from '@stamhoofd/structures';
import {
    Address,
    appToUri,
    Company,
    DocumentData,
    DocumentStatus,
    Permissions,
    RecordAddressAnswer,
    RecordCategory,
    RecordChoice,
    RecordChooseOneAnswer,
    RecordDateAnswer,
    RecordPriceAnswer,
    RecordSettings,
    RecordTextAnswer,
    RecordType,
    Token as TokenStruct,
    TranslatedString,
    Version,
} from '@stamhoofd/structures';
import { BelcotaxFeatureFlag } from '@stamhoofd/structures/belcotax/BelcotaxConnection.js';
import { BelcotaxDocumentStatus } from '@stamhoofd/structures/belcotax/BelcotaxSubmission.js';
import { TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import nock from 'nock';
import { WorkerData } from '../helpers/index.js';

const address = Address.create({ street: 'Kerkstraat', number: '1', postalCode: '9000', city: 'Gent', country: Country.Belgium });
// Only this spec logs in as this representative, see belcotaxRepresentatives
const representative = belcotaxRepresentatives[3];

function answers(values: Record<string, string | Date | number | Address | RecordChoice>): Map<string, RecordAnswer> {
    const map = new Map<string, RecordAnswer>();
    for (const [id, value] of Object.entries(values)) {
        if (value instanceof Address) {
            map.set(id, RecordAddressAnswer.create({ settings: RecordSettings.create({ id, type: RecordType.Address }), address: value }));
        } else if (value instanceof Date) {
            map.set(id, RecordDateAnswer.create({ settings: RecordSettings.create({ id, type: RecordType.Date }), dateValue: value }));
        } else if (value instanceof RecordChoice) {
            map.set(id, RecordChooseOneAnswer.create({ settings: RecordSettings.create({ id, type: RecordType.ChooseOne }), selectedChoice: value }));
        } else if (typeof value === 'number') {
            map.set(id, RecordPriceAnswer.create({ settings: RecordSettings.create({ id, type: RecordType.Price }), value }));
        } else {
            map.set(id, RecordTextAnswer.create({ settings: RecordSettings.create({ id, type: RecordType.Text }), value }));
        }
    }
    return map;
}

/**
 * The first name of the child chooses the outcome of the local Belcotax mock: "Geweigerd" is rejected by its business rules
 */
function documentAnswers(childFirstName: string) {
    return answers({
        'debtor.firstName': 'An',
        'debtor.lastName': 'Claes',
        'debtor.nationalRegisterNumber': '85.07.30-033.28',
        'debtor.address': address,
        'member.firstName': childFirstName,
        'member.lastName': 'Claes',
        'member.nationalRegisterNumber': '18.05.05-123.72',
        'member.birthDay': new Date(2018, 4, 5),
        'member.address': address,
        'registration.startDate': new Date(2026, 6, 1),
        'registration.endDate': new Date(2026, 6, 5),
        'registration.price': 75_0000,
    });
}

/**
 * The login of a legal representative at FOD Financiën, played by the Belcotax realm of the e2e
 * SSO server. Keycloak remembers a consent that was given, so the consent screen is optional.
 */
async function loginAtFod(page: Page) {
    await page.locator('#username').fill(representative.email);
    await page.locator('#password').fill(ssoUserPassword);
    await page.locator('#kc-login').click();

    const consentScreen = page.getByText('Fiscale fiches indienen bij Belcotax-on-web');
    const connected = page.getByText('De verbinding met Belcotax is gelukt');
    await expect(consentScreen.or(connected).first()).toBeVisible({ timeout: 15_000 });
    if (await consentScreen.isVisible()) {
        await page.locator('#kc-login').click();
    }
}

/**
 * Submitting from a fiscal template to the Belcotax API: connecting first when the organiser is not
 * connected, and the outcomes of the local mock of the bulk API.
 */
test.describe('Belcotax submission @belcotax-submit', () => {
    // Both tests log in as the same representative: Keycloak fails a token request when two logins of one user
    // give consent at the same time
    test.describe.configure({ mode: 'serial' });

    let organization: Organization;
    let admin: User;
    let template: DocumentTemplate;

    test.beforeAll(() => {
        // The API of this worker calls Keycloak and the mock of the bulk API itself
        nock.restore();
        // Like the download, so the documents of the template open by their URL
        TestUtils.setPermanentEnvironment('userMode', 'platform');
        TestUtils.setPermanentEnvironment('BELCOTAX_ENVIRONMENT', 'local');
    });

    test.afterAll(async () => {
        nock.activate();
        TestUtils.setPermanentEnvironment('BELCOTAX_ENVIRONMENT', undefined);
        await WorkerData.resetDatabase();
    });

    test.beforeEach(async () => {
        organization = await new OrganizationFactory({}).create();
        organization.meta.companies = [
            Company.create({ name: 'Jeugdhuis De Kelder vzw', companyNumber: '0999.999.031', address }),
        ];
        organization.privateMeta.featureFlags = [BelcotaxFeatureFlag];
        await organization.save();

        admin = await new UserFactory({
            organization,
            firstName: 'Els',
            lastName: 'Wouters',
            email: `belcotax-${Math.random().toString(36).slice(2)}@example.com`,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        template = await new DocumentTemplateFactory({
            organizationId: organization.id,
            type: 'fiscal',
            groups: [],
            year: 2026,
            updatesEnabled: false,
            status: DocumentStatus.Published,
        }).create();
        template.settings.name = 'Kamp 2026';
        template.privateSettings.templateDefinition.exportFieldCategories = [
            RecordCategory.create({
                id: 'additional-belcotax',
                name: TranslatedString.create('Bijkomende informatie'),
                records: [
                    RecordSettings.create({ id: 'organization.contactName', name: TranslatedString.create('Naam contactpersoon'), required: true, type: RecordType.Text }),
                    RecordSettings.create({ id: 'organization.phone', name: TranslatedString.create('Telefoonnummer'), required: true, type: RecordType.Phone }),
                    RecordSettings.create({ id: 'organization.email', name: TranslatedString.create('E-mailadres'), required: true, type: RecordType.Email }),
                ],
            }),
        ];
        template.settings.fieldAnswers = answers({
            'organization.companyName': 'Jeugdhuis De Kelder vzw',
            'organization.companyNumber': representative.companyNumber,
            'organization.companyAddress': address,
            'organization.contactName': 'Els Wouters',
            'organization.phone': '+32470123456',
            'organization.email': 'els@dekelder.be',
            'certification.type': RecordChoice.create({ id: 'authorities' }),
            'certification.name': 'Stad Gent',
            'certification.companyNumber': '0207451227',
            'certification.address': address,
        });
        await template.save();
    });

    async function createDocument(childFirstName: string, status = DocumentStatus.Published) {
        const document = new Document();
        document.organizationId = organization.id;
        document.templateId = template.id;
        document.status = status;
        document.data = DocumentData.create({ name: 'Fiscaal attest 2026', description: `${childFirstName} Claes, Kamp 2026`, fieldAnswers: documentAnswers(childFirstName) });
        await document.save();
        return document;
    }

    async function openTemplate(page: Page) {
        const token = await SessionService.createSession(admin);
        const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
        await page.addInitScript(({ organizationId, tokenString }) => {
            window.localStorage.setItem('token-' + (organizationId ?? 'platform'), tokenString);
        }, { organizationId: admin.organizationId, tokenString });

        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}/documenten/${template.id}`);
    }

    /**
     * Doorsturen asks the contact person first and connects when needed, after which the sheet opens again
     */
    async function connectAndOpenSheet(page: Page, expectedNewCount: number) {
        await page.getByTestId('belcotax-submit-action').click({ timeout: 30_000 });
        await expect(page.getByText('Contactpersoon voor Belcotax')).toBeVisible();
        await page.getByTestId('save-button').filter({ visible: true }).first().click();

        const sheet = page.getByTestId('belcotax-submit-view');
        await expect(sheet.getByTestId('belcotax-new-count')).toHaveText(expectedNewCount.toString(), { timeout: 30_000 });
        await expect(sheet.getByText('is nog niet verbonden met Belcotax')).toBeVisible();

        // Nothing is sent before connecting
        await sheet.getByTestId('belcotax-submit').click();
        await loginAtFod(page);

        await expect(page.getByText('De verbinding met Belcotax is gelukt')).toBeVisible({ timeout: 15_000 });
        expect((await BelcotaxConnection.getFor(organization.id, representative.companyNumber))?.isValid).toBe(true);

        await expect(sheet.getByTestId('belcotax-new-count')).toHaveText(expectedNewCount.toString(), { timeout: 30_000 });
        await expect(sheet.getByText('is nog niet verbonden met Belcotax')).toHaveCount(0);
        return sheet;
    }

    function resultStep(page: Page) {
        return page.getByTestId('belcotax-submission-view').getByTestId('belcotax-submission-step').nth(2);
    }

    test('connects the organiser first, then Belcotax accepts the documents', async ({ page }) => {
        test.setTimeout(120_000);
        const noah = await createDocument('Noah');
        const lena = await createDocument('Lena');
        // Removed before it was ever sent: its fiche may have been uploaded with the download
        const removed = await createDocument('Tom', DocumentStatus.Deleted);

        await openTemplate(page);
        const sheet = await connectAndOpenSheet(page, 2);
        await expect(sheet.getByTestId('belcotax-deleted-count')).toHaveText('1');

        await sheet.getByTestId('belcotax-submit').click();

        const submission = page.getByTestId('belcotax-submission-view');
        await expect(submission.getByText('3 attesten · door Els Wouters')).toBeVisible({ timeout: 30_000 });
        await expect(resultStep(page)).toHaveAttribute('data-state', 'done', { timeout: 60_000 });
        await expect(resultStep(page)).toContainText('Aanvaard');

        for (const document of [noah, lena, removed]) {
            expect((await Document.getByID(document.id))?.belcotaxStatus).toBe(BelcotaxDocumentStatus.Accepted);
        }

        // Everything was accepted, so nothing goes along the next time
        await openTemplate(page);
        await page.getByTestId('belcotax-submissions-action').filter({ hasText: '3 attesten, aanvaard' }).waitFor({ timeout: 30_000 });
        await page.getByTestId('belcotax-submit-action').click();
        await page.getByTestId('save-button').filter({ visible: true }).first().click();
        const again = page.getByTestId('belcotax-submit-view');
        await expect(again.getByText('Belcotax aanvaardde 2 attesten al. Die gaan niet opnieuw mee.')).toBeVisible({ timeout: 30_000 });
        await expect(again.getByTestId('belcotax-deleted-count')).toHaveText('0');
        await expect(again.getByTestId('belcotax-submit')).toBeDisabled();
    });

    test('Belcotax rejects the submission and shows the errors per document', async ({ page }) => {
        test.setTimeout(120_000);
        const noah = await createDocument('Noah');
        await createDocument('Geweigerd');

        await openTemplate(page);
        const sheet = await connectAndOpenSheet(page, 2);

        await sheet.getByTestId('belcotax-submit').click();

        await expect(resultStep(page)).toHaveAttribute('data-state', 'failed', { timeout: 60_000 });
        await expect(resultStep(page)).toContainText('Geweigerd');

        const submission = page.getByTestId('belcotax-submission-view');
        await expect(submission.getByText('1 fout van Belcotax')).toBeVisible();
        const issue = submission.getByTestId('belcotax-submission-issue');
        await expect(issue).toHaveCount(1);
        await expect(issue).toContainText('Geweigerd Claes, Kamp 2026');
        await expect(issue).toContainText('Het aantal dagen is groter dan het aantal dagen tussen begin- en einddatum (periode 1).');

        // Belcotax refuses the whole file, so the other document goes again too
        expect((await Document.getByID(noah.id))?.belcotaxStatus).toBe(BelcotaxDocumentStatus.Rejected);

        // The error opens the document
        await issue.click();
        await expect(page.getByText('Sleutel voor Belcotax')).toBeVisible();

        // The link in the email opens the submission on its template
        const submitted = await BelcotaxSubmission.select().where('templateId', template.id).first(true);
        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}/documenten/${template.id}?belcotax_submission=${submitted.id}`);
        await expect(page.getByTestId('belcotax-submission-view').getByText('Geweigerd Claes, Kamp 2026')).toBeVisible({ timeout: 30_000 });
        expect(new URL(page.url()).searchParams.get('belcotax_submission')).toBeNull();
    });
});
