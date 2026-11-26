// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import type { DocumentTemplate, Organization, User } from '@stamhoofd/models';
import { Document, DocumentTemplateFactory, OrganizationFactory, UserFactory } from '@stamhoofd/models';
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
import { TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { readFile } from 'node:fs/promises';
import { WorkerData } from '../helpers/index.js';

const address = Address.create({ street: 'Kerkstraat', number: '1', postalCode: '9000', city: 'Gent', country: Country.Belgium });

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

const completeDocumentAnswers = {
    'debtor.firstName': 'An',
    'debtor.lastName': 'Claes',
    'debtor.nationalRegisterNumber': '85.07.30-033.28',
    'debtor.address': address,
    'member.firstName': 'Noah',
    'member.lastName': 'Claes',
    'member.nationalRegisterNumber': '18.05.05-123.72',
    'member.birthDay': new Date(2018, 4, 5),
    'member.address': address,
    'registration.startDate': new Date(2026, 6, 1),
    'registration.endDate': new Date(2026, 6, 5),
    'registration.price': 75_0000,
};

test.describe('JSONL download @jsonl-download', () => {
    async function createOrganizationWithTemplate(name: string, companyNumber: string | null) {
        const organization = await new OrganizationFactory({ name: `${name} ${WorkerData.id}` }).create();
        organization.meta.companies = [Company.create({ name, companyNumber, address })];
        await organization.save();

        const admin = await new UserFactory({
            organization,
            email: `belcotax-${WorkerData.id}-${Math.floor(Math.random() * 1_000_000)}@example.com`,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        const template = await new DocumentTemplateFactory({
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
                    RecordSettings.create({ id: 'organization.companyNumber', name: TranslatedString.create('Ondernemingsnummer of refertenummer'), required: true, type: RecordType.Text }),
                ],
            }),
        ];
        // The contact person of an earlier download is filled in again
        template.settings.fieldAnswers = answers({
            'organization.companyName': name,
            'organization.companyNumber': companyNumber ?? '',
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

        return { organization, admin, template };
    }

    async function createDocument(organization: Organization, template: DocumentTemplate, description: string, values: Record<string, string | Date | number | Address>, status = DocumentStatus.Published) {
        const document = new Document();
        document.organizationId = organization.id;
        document.templateId = template.id;
        document.status = status;
        document.data = DocumentData.create({ name: 'Fiscaal attest 2026', description, fieldAnswers: answers(values) });
        await document.save();
        return document;
    }

    async function openTemplate(page: Page, admin: User, organization: Organization, template: DocumentTemplate) {
        const token = await SessionService.createSession(admin);
        const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
        await page.addInitScript(({ organizationId, tokenString }) => {
            window.localStorage.setItem('token-' + (organizationId ?? 'platform'), tokenString);
        }, { organizationId: admin.organizationId, tokenString });

        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}/documenten/${template.id}`);
    }

    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');
    });

    test('an administrator downloads the file without the rejected and incomplete documents', async ({ page }) => {
        test.setTimeout(90_000);

        const { organization, admin, template } = await createOrganizationWithTemplate('Jeugdhuis De Kelder vzw', '0308357159');
        const complete = await createDocument(organization, template, 'Noah Claes, Kamp 2026', completeDocumentAnswers);
        const missingData = await createDocument(organization, template, 'Mila Claes, Kamp 2026', { ...completeDocumentAnswers, 'member.firstName': 'Mila' }, DocumentStatus.MissingData);
        const rejected = await createDocument(organization, template, 'Lena Claes, Kamp 2026', { ...completeDocumentAnswers, 'member.firstName': 'Lena', 'debtor.nationalRegisterNumber': '', 'debtor.address': Address.create({ country: Country.Belgium }) });

        await openTemplate(page, admin, organization, template);

        // The XML export is replaced by the Belcotax file from 2026
        await expect(page.getByText('Exporteren naar XML (voor Belcotax)')).toHaveCount(0);
        await page.getByText('Bestand downloaden voor Belcotax').click({ timeout: 30_000 });

        // Only the contact person is asked, filled in with the earlier answers
        await expect(page.getByText('Contactpersoon voor Belcotax')).toBeVisible();
        await expect(page.getByText('Ondernemingsnummer of refertenummer')).toHaveCount(0);
        await expect(page.getByText('Belcotax gebruikt dit e-mailadres als contact voor vragen over de fiscale attesten.')).toBeVisible();
        await page.getByTestId('save-button').filter({ visible: true }).first().click();

        // The check lists the document Belcotax would reject and the incomplete one, by child and activity
        await expect(page.getByText('2 attesten gaan niet mee')).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText('1 ander attest staat wel in het bestand.')).toBeVisible();
        await expect(page.getByText('1 attest kan niet mee')).toBeVisible();
        await expect(page.getByText('Lena Claes, Kamp 2026')).toBeVisible();
        await expect(page.getByText('1 onvolledig attest gaat niet mee')).toBeVisible();
        await expect(page.getByText('Mila Claes, Kamp 2026')).toBeVisible();
        await expect(page.getByText('Noah Claes, Kamp 2026')).toHaveCount(0);

        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Downloaden zonder deze 2' }).click();
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toBe('Kamp 2026.jsonl');
        const lines = (await readFile(await download.path(), 'utf8')).trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>);
        expect(lines.some(line => line['k'] === `STA-2026-${complete.id}`)).toBe(true);
        expect(lines.some(line => line['k'] === `STA-2026-${rejected.id}`)).toBe(false);
        expect(lines.some(line => line['k'] === `STA-2026-${missingData.id}`)).toBe(false);
        expect(lines).toContainEqual(expect.objectContaining({ k: `STA-org-${organization.meta.companies[0].id}`, i: { cbein: '0308357159' } }));

        await expect(page.getByText('Bestand gedownload')).toBeVisible();
        await expect(page.getByText('Kies Zending per bestand en laad Kamp 2026.jsonl op.')).toBeVisible();
        await expect(page.getByText('Krijg je een fout met een sleutel (STA-2026-…)? Plak die in de zoekbalk van Documenten.')).toBeVisible();
    });

    test('a feitelijke vereniging without a company number is told to submit in Belcotax-on-web', async ({ page }) => {
        test.setTimeout(90_000);

        const { organization, admin, template } = await createOrganizationWithTemplate('Chiro Sint-Jan', null);
        await createDocument(organization, template, 'Noah Claes, Kamp 2026', completeDocumentAnswers);

        const exportRequests: string[] = [];
        page.on('request', (request) => {
            if (request.url().includes('/jsonl')) {
                exportRequests.push(request.url());
            }
        });

        await openTemplate(page, admin, organization, template);
        await page.getByText('Bestand downloaden voor Belcotax').click({ timeout: 30_000 });

        await expect(page.getByText('Ondernemingsnummer nodig')).toBeVisible();
        await expect(page.getByText(/geef je de fiscale attesten rechtstreeks in op Belcotax-on-web/)).toBeVisible();
        await expect(page.getByText('Contactpersoon voor Belcotax')).toHaveCount(0);
        expect(exportRequests).toEqual([]);
    });
});
