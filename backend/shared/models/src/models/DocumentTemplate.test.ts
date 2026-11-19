import {
    DocumentStatus,
    GroupSettings,
    MemberDetails,
    NationalRegisterNumberOptOut,
    Parent,
    RecordCategory,
    RecordSettings,
    RecordType,
    TranslatedString,
} from '@stamhoofd/structures';
import { DocumentTemplateFactory } from '../factories/DocumentTemplateFactory.js';
import { MemberFactory } from '../factories/MemberFactory.js';
import { OrganizationFactory } from '../factories/OrganizationFactory.js';
import { RegistrationFactory } from '../factories/RegistrationFactory.js';
import { Document } from './Document.js';
import { DocumentTemplate, getTaxDependentDebtors, splitPrice } from './DocumentTemplate.js';
import { Group } from './Group.js';
import type { Organization } from './Organization.js';
import type { RegistrationWithMember } from './Member.js';
import { Member } from './Member.js';
import { Registration } from './Registration.js';

describe('Model.DocumentTemplate', () => {
    it('clones linked default answers and retains built-in answers not listed in the template', async () => {
        const group = new Group();
        group.id = 'group';
        group.organizationId = 'organization';
        group.settings = GroupSettings.create({ name: TranslatedString.create('Camp') });
        const member = new Member();
        member.details = MemberDetails.create({ firstName: 'Jane', lastName: 'Doe' });
        const registration = Object.assign(new Registration(), {
            member,
            group,
            groupId: group.id,
        });
        const template = await new DocumentTemplateFactory({ groups: [group] }).createWithoutSave();
        const requiredUnknown = RecordSettings.create({
            id: 'unknown',
            type: RecordType.Text,
            required: true,
        });
        template.privateSettings.templateDefinition.documentFieldCategories.push(
            RecordCategory.create({ records: [requiredUnknown] }),
        );

        const { fieldAnswers, missingData } = await template.buildAnswers(registration, {
            balance: { items: [], payments: [], balanceItemPayments: [] },
        });

        expect(fieldAnswers.get('member.firstName')?.objectValue).toBe('Jane');
        expect(fieldAnswers.get('renamedValue')?.objectValue).toBe('Jane');
        expect(fieldAnswers.get('renamedValue')).not.toBe(fieldAnswers.get('member.firstName'));
        expect(fieldAnswers.get('renamedValue')?.settings.id).toBe('renamedValue');
        expect(fieldAnswers.get('member.firstName')?.settings.id).toBe('member.firstName');
        expect(fieldAnswers.get('registration.priceOriginal')?.objectValue).toBe(0);
        expect(fieldAnswers.get('unknown')?.isEmpty).toBe(true);
        expect(missingData).toBe(true);
    });

    it('PublishedAt should be set if status is published and publishedAt is null', async () => {
        const documentTemplate = await new DocumentTemplateFactory({
            status: DocumentStatus.Published,
            groups: [],
        }).create();

        expect(documentTemplate.publishedAt).not.toBeNull();
    });

    it('PublishedAt should not change if status is published and publishedAt is already set', async () => {
        const documentTemplate = await new DocumentTemplateFactory({
            status: DocumentStatus.Published,
            publishedAt: new Date(2025, 5, 1),
            groups: [],
        }).create();

        expect(documentTemplate.publishedAt?.getTime()).toBe(new Date(2025, 5, 1).getTime());
    });

    it('PublishedAt should be set to null if status is draft', async () => {
        const documentTemplate = await new DocumentTemplateFactory({
            status: DocumentStatus.Draft,
            publishedAt: new Date(2025, 5, 1),
            groups: [],
        }).create();

        expect(documentTemplate.publishedAt).toBeNull();
    });

    // should probably never happen
    it('PublishedAt should be not change if status is not draft or published', async () => {
        const documentTemplate1 = await new DocumentTemplateFactory({
            status: DocumentStatus.Deleted,
            publishedAt: new Date(2025, 5, 1),
            groups: [],
        }).create();

        const documentTemplate2 = await new DocumentTemplateFactory({
            status: DocumentStatus.Deleted,
            publishedAt: null,
            groups: [],
        }).create();

        const documentTemplate3 = await new DocumentTemplateFactory({
            status: DocumentStatus.MissingData,
            publishedAt: new Date(2025, 5, 1),
            groups: [],
        }).create();

        const documentTemplate4 = await new DocumentTemplateFactory({
            status: DocumentStatus.MissingData,
            publishedAt: null,
            groups: [],
        }).create();

        expect(documentTemplate1.publishedAt?.getTime()).toBe(new Date(2025, 5, 1).getTime());
        expect(documentTemplate2.publishedAt).toBeNull();
        expect(documentTemplate3.publishedAt?.getTime()).toBe(new Date(2025, 5, 1).getTime());
        expect(documentTemplate4.publishedAt).toBeNull();
    });
});

describe('Model.DocumentTemplate removing documents', () => {
    let organization: Organization;

    beforeEach(async () => {
        organization = await new OrganizationFactory({}).create();
    });

    async function createTemplate(type: string, year: number) {
        return await new DocumentTemplateFactory({
            organizationId: organization.id,
            type,
            year,
            groups: [],
            status: DocumentStatus.Published,
        }).create();
    }

    async function createDocument(
        template: DocumentTemplate,
        status: DocumentStatus,
        registrationId: string | null = null,
    ) {
        const document = new Document();
        document.organizationId = template.organizationId;
        document.templateId = template.id;
        document.status = status;
        document.registrationId = registrationId;
        await document.save();
        return document;
    }

    async function createRegistration() {
        const member = await new MemberFactory({ organization }).create();
        return await new RegistrationFactory({ member, organization }).create();
    }

    test('From 2026 a published fiscal document stays as deleted, because it can be in a file uploaded to Belcotax', async () => {
        const template = await createTemplate('fiscal', 2026);
        const published = await createDocument(template, DocumentStatus.Published);
        const draft = await createDocument(template, DocumentStatus.Draft);

        await template.buildAll();

        expect((await Document.getByID(published.id))?.status).toBe(DocumentStatus.Deleted);
        expect(await Document.getByID(draft.id)).toBeUndefined();
    });

    test('Before 2026 a published document without number is still removed', async () => {
        const template = await createTemplate('fiscal', 2025);
        const published = await createDocument(template, DocumentStatus.Published);

        await template.buildAll();

        expect(await Document.getByID(published.id)).toBeUndefined();
    });

    test('A registration that no longer matches keeps its published fiscal document from 2026 as deleted', async () => {
        const template = await createTemplate('fiscal', 2026);
        const registration = await createRegistration();
        const document = await createDocument(template, DocumentStatus.Published, registration.id);

        // The template has no groups, so the registration is no longer included
        await template.updateForRegistration(registration as RegistrationWithMember, [document]);

        expect((await Document.getByID(document.id))?.status).toBe(DocumentStatus.Deleted);
    });

    test('Deactivating a registration keeps its published fiscal document from 2026 as deleted', async () => {
        const fiscal = await createTemplate('fiscal', 2026);
        const participation = await createTemplate('participation', 2026);
        const registration = await createRegistration();
        const fiscalDocument = await createDocument(
            fiscal,
            DocumentStatus.Published,
            registration.id,
        );
        const participationDocument = await createDocument(
            participation,
            DocumentStatus.Published,
            registration.id,
        );

        await DocumentTemplate.deleteForRegistrations([registration]);

        expect((await Document.getByID(fiscalDocument.id))?.status).toBe(DocumentStatus.Deleted);
        expect(await Document.getByID(participationDocument.id)).toBeUndefined();
    });

    test('A kept document survives a second build, otherwise its deletion never reaches Belcotax', async () => {
        const template = await createTemplate('fiscal', 2026);
        const document = await createDocument(template, DocumentStatus.Published);

        await template.buildAll();
        await template.buildAll();

        expect((await Document.getByID(document.id))?.status).toBe(DocumentStatus.Deleted);
    });

    test('Deactivating a registration of a locked template does not fail', async () => {
        const template = await createTemplate('fiscal', 2026);
        const registration = await createRegistration();
        const document = await createDocument(template, DocumentStatus.Published, registration.id);
        document.isLocked = true;
        await document.save({ forceSave: true });

        await DocumentTemplate.deleteForRegistrations([registration]);

        expect((await Document.getByID(document.id))?.status).toBe(DocumentStatus.Published);
    });

    test('A registration that becomes active again gets its kept document back', async () => {
        const template = await createTemplate('fiscal', 2026);
        const registration = await createRegistration();
        const document = await createDocument(template, DocumentStatus.Published, registration.id);

        await DocumentTemplate.deleteForRegistrations([registration]);
        expect((await Document.getByID(document.id))?.status).toBe(DocumentStatus.Deleted);

        await DocumentTemplate.reissueForRegistrations([registration]);

        // Issued again, and incomplete instead of published because this document has no answers
        expect((await Document.getByID(document.id))?.status).toBe(DocumentStatus.MissingData);
    });

    test('A document of a template before 2026 is not reissued', async () => {
        const template = await createTemplate('fiscal', 2025);
        const registration = await createRegistration();
        const document = await createDocument(template, DocumentStatus.Deleted, registration.id);

        await DocumentTemplate.reissueForRegistrations([registration]);

        expect((await Document.getByID(document.id))?.status).toBe(DocumentStatus.Deleted);
    });
});

describe('Model.getTaxDependentDebtors', () => {
    function parent({
        name,
        isMemberTaxDependent,
        nationalRegisterNumber,
    }: {
        name: string;
        isMemberTaxDependent?: boolean | null;
        nationalRegisterNumber?: string | typeof NationalRegisterNumberOptOut | null;
    }) {
        return Parent.create({
            firstName: name,
            lastName: 'Doe',
            isMemberTaxDependent: isMemberTaxDependent ?? null,
            nationalRegisterNumber: nationalRegisterNumber ?? null,
        });
    }

    test('falls back to the old debtor logic when nobody has the member tax dependent', () => {
        const parents = [parent({ name: 'Linda', nationalRegisterNumber: '93042012345' })];

        expect(getTaxDependentDebtors(parents)).toEqual([]);
    });

    test('picks the parent that has the member tax dependent', () => {
        const linda = parent({
            name: 'Linda',
            isMemberTaxDependent: true,
            nationalRegisterNumber: '93042012345',
        });
        const john = parent({ name: 'John', nationalRegisterNumber: '93042017297' });

        expect(getTaxDependentDebtors([john, linda])).toEqual([
            { debtor: linda, missingData: false },
        ]);
    });

    // The certificate has to carry the name the family chose, even though it cannot be completed
    test('keeps a tax dependent parent that opted out, instead of falling back to another parent', () => {
        const linda = parent({
            name: 'Linda',
            isMemberTaxDependent: true,
            nationalRegisterNumber: NationalRegisterNumberOptOut,
        });
        const john = parent({ name: 'John', nationalRegisterNumber: '93042017297' });

        expect(getTaxDependentDebtors([linda, john])).toEqual([
            { debtor: linda, missingData: true },
        ]);
    });

    test('reports missing data when the tax dependent parent has no number yet', () => {
        const linda = parent({ name: 'Linda', isMemberTaxDependent: true });

        expect(getTaxDependentDebtors([linda])).toEqual([{ debtor: linda, missingData: true }]);
    });

    test('with co-parenting, both parents become a debtor in the order of the parents', () => {
        const linda = parent({
            name: 'Linda',
            isMemberTaxDependent: true,
            nationalRegisterNumber: '93042012345',
        });
        const john = parent({
            name: 'John',
            isMemberTaxDependent: true,
            nationalRegisterNumber: '93042017297',
        });

        expect(getTaxDependentDebtors([linda, john])).toEqual([
            { debtor: linda, missingData: false },
            { debtor: john, missingData: false },
        ]);
    });

    test('with co-parenting, missing data is tracked per parent', () => {
        const linda = parent({
            name: 'Linda',
            isMemberTaxDependent: true,
            nationalRegisterNumber: NationalRegisterNumberOptOut,
        });
        const john = parent({
            name: 'John',
            isMemberTaxDependent: true,
            nationalRegisterNumber: '93042017297',
        });

        expect(getTaxDependentDebtors([linda, john])).toEqual([
            { debtor: linda, missingData: true },
            { debtor: john, missingData: false },
        ]);
    });
});

describe('Model.splitPrice', () => {
    test('splits an even amount in equal halves', () => {
        expect(splitPrice(1000000, 2, 0)).toBe(500000);
        expect(splitPrice(1000000, 2, 1)).toBe(500000);
    });

    test('gives the remaining cent to the first document', () => {
        expect(splitPrice(1234500, 2, 0)).toBe(617300);
        expect(splitPrice(1234500, 2, 1)).toBe(617200);
    });

    test('never splits below a whole cent', () => {
        expect(splitPrice(1234567, 2, 0)).toBe(617367);
        expect(splitPrice(1234567, 2, 1)).toBe(617200);
    });

    test('halves of a negative amount add up to the total', () => {
        expect(splitPrice(-500, 2, 0) + splitPrice(-500, 2, 1)).toBe(-500);
    });
});
