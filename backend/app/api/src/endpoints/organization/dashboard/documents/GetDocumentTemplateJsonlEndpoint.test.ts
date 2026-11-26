import { Request } from '@node/endpoints';
import { EmailMocker } from '@stamhoofd/email';
import type { DocumentTemplate, Organization } from '@stamhoofd/models';
import {
    Document,
    DocumentTemplateFactory,
    OrganizationFactory,
    UserFactory,
} from '@stamhoofd/models';
import type { RecordAnswer } from '@stamhoofd/structures';
import {
    Address,
    Company,
    DocumentData,
    DocumentStatus,
    Permissions,
    RecordAddressAnswer,
    RecordChoice,
    RecordChooseOneAnswer,
    RecordDateAnswer,
    RecordPriceAnswer,
    RecordSettings,
    RecordTextAnswer,
    RecordType,
} from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../../services/SessionService.js';
import { GetDocumentTemplateJsonlEndpoint } from './GetDocumentTemplateJsonlEndpoint.js';

const endpoint = new GetDocumentTemplateJsonlEndpoint();

const address = Address.create({
    street: 'Kerkstraat',
    number: '1',
    postalCode: '9000',
    city: 'Gent',
    country: Country.Belgium,
});

function answers(
    values: Record<string, string | Date | number | Address | RecordChoice>,
): Map<string, RecordAnswer> {
    const map = new Map<string, RecordAnswer>();
    for (const [id, value] of Object.entries(values)) {
        if (value instanceof Address) {
            map.set(
                id,
                RecordAddressAnswer.create({
                    settings: RecordSettings.create({ id, type: RecordType.Address }),
                    address: value,
                }),
            );
        } else if (value instanceof Date) {
            map.set(
                id,
                RecordDateAnswer.create({
                    settings: RecordSettings.create({ id, type: RecordType.Date }),
                    dateValue: value,
                }),
            );
        } else if (value instanceof RecordChoice) {
            map.set(
                id,
                RecordChooseOneAnswer.create({
                    settings: RecordSettings.create({ id, type: RecordType.ChooseOne }),
                    selectedChoice: value,
                }),
            );
        } else if (typeof value === 'number') {
            map.set(
                id,
                RecordPriceAnswer.create({
                    settings: RecordSettings.create({ id, type: RecordType.Price }),
                    value,
                }),
            );
        } else {
            map.set(
                id,
                RecordTextAnswer.create({
                    settings: RecordSettings.create({ id, type: RecordType.Text }),
                    value,
                }),
            );
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

describe('Endpoint.GetDocumentTemplateJsonlEndpoint', () => {
    let organization: Organization;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');

        organization = await new OrganizationFactory({}).create();
        organization.meta.companies = [
            Company.create({
                name: 'Jeugdhuis De Kelder vzw',
                companyNumber: '0123456789',
                address,
            }),
        ];
        await organization.save();
    });

    async function createTemplate(options: { year?: number; updatesEnabled?: boolean } = {}) {
        const template = await new DocumentTemplateFactory({
            organizationId: organization.id,
            type: 'fiscal',
            groups: [],
            year: options.year ?? 2026,
            updatesEnabled: options.updatesEnabled ?? false,
            status: DocumentStatus.Published,
        }).create();

        template.settings.fieldAnswers = answers({
            'organization.companyName': 'Jeugdhuis De Kelder vzw',
            'organization.companyNumber': '0123456789',
            'organization.companyAddress': address,
            'organization.contactName': 'Els Wouters',
            'organization.phone': '0470 12 34 56',
            'organization.email': 'els@dekelder.be',
            'certification.type': RecordChoice.create({ id: 'authorities' }),
            'certification.name': 'Stad Gent',
            'certification.companyNumber': '0207451227',
            'certification.address': address,
        });
        await template.save();
        return template;
    }

    async function createDocument(
        template: DocumentTemplate,
        status: DocumentStatus,
        values: Record<string, string | Date | number | Address>,
    ) {
        const document = new Document();
        document.organizationId = organization.id;
        document.templateId = template.id;
        document.status = status;
        document.data = DocumentData.create({
            name: 'Fiscaal attest 2026',
            description: `${String(values['member.firstName'] ?? '')} Claes, Kamp 2026`,
            fieldAnswers: answers(values),
        });
        await document.save();
        return document;
    }

    async function get(template: DocumentTemplate, level = PermissionLevel.Full) {
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level }),
        }).create();
        const token = await SessionService.createSession(user);
        return testServer.test(
            endpoint,
            Request.get({
                path: `/organization/document-templates/${template.id}/jsonl`,
                host: organization.getApiHost(),
                headers: { authorization: 'Bearer ' + token.accessToken },
            }),
        );
    }

    test('Published documents become fiches, deleted documents delete lines, rejected and incomplete documents are reported', async () => {
        const template = await createTemplate();
        const complete = await createDocument(
            template,
            DocumentStatus.Published,
            completeDocumentAnswers,
        );
        const deleted = await createDocument(
            template,
            DocumentStatus.Deleted,
            completeDocumentAnswers,
        );
        const missingData = await createDocument(template, DocumentStatus.MissingData, {
            ...completeDocumentAnswers,
            'member.firstName': 'Mila',
        });
        const rejected = await createDocument(template, DocumentStatus.Published, {
            ...completeDocumentAnswers,
            'member.firstName': 'Lena',
            'debtor.nationalRegisterNumber': '',
            'debtor.address': Address.create({ country: Country.Belgium }),
        });

        const response = await get(template);

        expect(response.status).toBe(200);
        const result = response.body;
        const lines = result.jsonl
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line) as Record<string, unknown>);

        expect(lines).toContainEqual(
            expect.objectContaining({
                k: `STA-2026-${complete.id}`,
                d: `STA-org-${organization.meta.companies[0].id}`,
            }),
        );
        expect(lines).toContainEqual({ $s: 'urn:f:x:1', k: `STA-2026-${deleted.id}` });
        expect(lines.some((line) => line['k'] === `STA-2026-${rejected.id}`)).toBe(false);
        expect(lines).toContainEqual(
            expect.objectContaining({ k: `STA-contact-${template.id}`, e: 'els@dekelder.be' }),
        );

        expect(lines.some((line) => line['k'] === `STA-2026-${missingData.id}`)).toBe(false);
        expect(result.incompleteDocuments).toEqual([
            expect.objectContaining({ id: missingData.id, description: 'Mila Claes, Kamp 2026' }),
        ]);

        expect(result.documentCount).toBe(1);
        expect(result.deletedCount).toBe(1);
        expect(result.issues.length).toBeGreaterThan(0);
        expect(
            result.issues.every(
                (issue) =>
                    issue.documentId === rejected.id &&
                    issue.documentDescription === 'Lena Claes, Kamp 2026',
            ),
        ).toBe(true);

        // The organization fixes this certificate itself in the check, so there is nothing to mail the webmaster
        const emails = (await EmailMocker.transactional.getSucceededEmails()).filter((e) =>
            e.subject.startsWith('Belcotax-export'),
        );
        expect(emails).toHaveLength(0);
    });

    test('A certificate that passes our checks but not the schema is mailed to the webmaster', async () => {
        const template = await createTemplate();
        const document = await createDocument(template, DocumentStatus.Published, {
            ...completeDocumentAnswers,
            // The check digit is right, but day 32 does not exist: only the schema of FOD catches that
            'member.nationalRegisterNumber': '18.05.32-123.38',
        });

        const response = await get(template);

        expect(response.status).toBe(200);
        expect(response.body.issues).toEqual([
            expect.objectContaining({
                documentId: document.id,
                message: 'Dit attest voldoet niet aan het formaat van Belcotax.',
            }),
        ]);

        const emails = (await EmailMocker.transactional.getSucceededEmails()).filter((e) =>
            e.subject.startsWith('Belcotax-export'),
        );
        expect(emails).toHaveLength(1);
        expect(emails[0].html).toContain(document.id);
        // The description names a child, so it may not end up in the mail
        expect(emails[0].html).not.toContain('Claes');
    });

    test('Without a contact person nothing can be sent', async () => {
        const template = await createTemplate();
        template.settings.fieldAnswers.delete('organization.contactName');
        template.settings.fieldAnswers.delete('organization.email');
        await template.save();
        await createDocument(template, DocumentStatus.Published, completeDocumentAnswers);

        const response = await get(template);

        expect(response.body.issues).toContainEqual(expect.objectContaining({ documentId: null }));
        expect(response.body.isBlocked).toBe(true);
    });

    test('A feitelijke vereniging without a company number cannot export', async () => {
        organization.meta.companies = [
            Company.create({ name: 'Chiro Sint-Jan', companyNumber: null, address }),
        ];
        await organization.save();
        const template = await createTemplate();
        template.settings.fieldAnswers = new Map([
            ...template.settings.fieldAnswers,
            ...answers({ 'organization.companyNumber': '' }),
        ]);
        await template.save();
        await createDocument(template, DocumentStatus.Published, completeDocumentAnswers);

        await expect(get(template)).rejects.toThrow(
            STExpect.errorWithCode('jsonl_export_requires_company_number'),
        );

        const emails = (await EmailMocker.transactional.getSucceededEmails()).filter(
            (e) => e.subject.startsWith('Belcotax-export') && e.html?.includes(template.id),
        );
        expect(emails).toHaveLength(0);
    });

    test('Without a company number on the template, the one of the billing details is used', async () => {
        const template = await createTemplate();
        template.settings.fieldAnswers = new Map([
            ...template.settings.fieldAnswers,
            ...answers({ 'organization.companyNumber': '' }),
        ]);
        await template.save();
        await createDocument(template, DocumentStatus.Published, completeDocumentAnswers);

        const response = await get(template);

        expect(response.body.issues).toEqual([]);
        expect(response.body.jsonl).toContain('"cbein":"0123456789"');
    });

    test('An admin without permission to manage documents cannot export', async () => {
        const template = await createTemplate();

        await expect(get(template, PermissionLevel.Read)).rejects.toThrow(
            STExpect.errorWithCode('permission_denied'),
        );
    });

    test('Fiscal documents before 2026 use the XML export', async () => {
        const template = await createTemplate({ year: 2025 });

        await expect(get(template)).rejects.toThrow(
            STExpect.errorWithCode('jsonl_export_not_supported'),
        );
    });

    test('Automatic updates have to be disabled first', async () => {
        const template = await createTemplate({ updatesEnabled: true });

        await expect(get(template)).rejects.toThrow(STExpect.errorWithCode('updates_enabled'));
    });
});
