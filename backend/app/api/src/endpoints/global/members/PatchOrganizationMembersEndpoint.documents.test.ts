import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import type { Endpoint } from '@simonbackx/simple-endpoints';
import { Request } from '@simonbackx/simple-endpoints';
import type { DocumentTemplate, Group, Member, Organization, Registration } from '@stamhoofd/models';
import { BalanceItemFactory, Document, DocumentTemplateFactory, GroupFactory, MemberFactory, OrganizationFactory, RegistrationFactory, UserFactory } from '@stamhoofd/models';
import { splitPrice } from '@stamhoofd/models/models/DocumentTemplate.js';
import type { RecordAnswer } from '@stamhoofd/structures';
import { DocumentData, DocumentStatus, Document as DocumentStruct, MemberDetails, MemberWithRegistrationsBlob, Parent, PermissionLevel, Permissions, RecordCategory, RecordPriceAnswer, RecordSettings, RecordTextAnswer, RecordType } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';
import { PatchDocumentEndpoint } from '../../organization/dashboard/documents/PatchDocumentEndpoint.js';
import { PatchOrganizationMembersEndpoint } from './PatchOrganizationMembersEndpoint.js';

const endpoint = new PatchOrganizationMembersEndpoint();
type EndpointType = typeof endpoint;
type Body = EndpointType extends Endpoint<any, any, infer B, any> ? B : never;

// An odd number of cents (prices carry two extra decimals), so the halves differ by one cent
const total = 1234500;

/**
 * Tax certificates issued to the parents that have the member tax dependent, through member edits in the dashboard.
 */
describe('Endpoint.PatchOrganizationMembersEndpoint.documents', () => {
    let organization: Organization;
    let group: Group;
    let template: DocumentTemplate;
    let accessToken: string;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    beforeAll(async () => {
        organization = await new OrganizationFactory({}).create();
        group = await new GroupFactory({ organization }).create();
        template = await createFiscalTemplate(group);

        const admin = await new UserFactory({
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        accessToken = (await SessionService.createSession(admin)).accessToken;
    });

    async function createFiscalTemplate(group: Group, { withDebtor = true } = {}) {
        const template = await new DocumentTemplateFactory({
            groups: [group],
            status: DocumentStatus.Published,
            type: 'fiscal',
        }).createWithoutSave();

        if (withDebtor) {
            template.privateSettings.templateDefinition.documentFieldCategories.push(RecordCategory.create({
                records: [
                    RecordSettings.create({ id: 'debtor.firstName', required: true, type: RecordType.Text }),
                    RecordSettings.create({ id: 'debtor.lastName', required: true, type: RecordType.Text }),
                    RecordSettings.create({ id: 'debtor.nationalRegisterNumber', required: false, type: RecordType.Text }),
                ],
            }));
        }
        await template.save();
        return template;
    }

    function parent(firstName: string, { nationalRegisterNumber = null, isMemberTaxDependent = null }: { nationalRegisterNumber?: string | null; isMemberTaxDependent?: boolean | null } = {}) {
        return Parent.create({
            firstName,
            lastName: 'Doe',
            email: firstName.toLowerCase() + '@example.com',
            nationalRegisterNumber,
            isMemberTaxDependent,
            updatedAt: new Date(0),
        });
    }

    async function createFamily(parents: Parent[], { template: familyTemplate = template } = {}): Promise<{ member: Member; registration: Registration }> {
        const member = await new MemberFactory({
            organization,
            details: MemberDetails.create({
                firstName: 'Jane',
                lastName: 'Doe',
                birthDay: new Date(2015, 0, 1),
                parents,
            }),
        }).create();
        const registration = await new RegistrationFactory({ member, group }).create();
        await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: member.id,
            registrationId: registration.id,
            amount: 1,
            unitPrice: total,
            pricePaid: total,
        }).create();
        await familyTemplate.buildAll();
        return { member, registration };
    }

    async function patchMember(member: Member, details: AutoEncoderPatchType<MemberDetails>) {
        const arr: Body = new PatchableArray();
        arr.addPatch(MemberWithRegistrationsBlob.patch({ id: member.id, details }));

        const request = Request.buildJson('PATCH', '/organization/members', organization.getApiHost(), arr);
        request.headers.authorization = 'Bearer ' + accessToken;
        const response = await testServer.test(endpoint, request);
        expect(response.status).toBe(200);
    }

    async function patchParents(member: Member, ...patches: AutoEncoderPatchType<Parent>[]) {
        const parents = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
        for (const patch of patches) {
            parents.addPatch(patch);
        }
        await patchMember(member, MemberDetails.patch({ parents }));
    }

    function taxDependent(parent: Parent, isMemberTaxDependent: boolean) {
        return Parent.patch({ id: parent.id, isMemberTaxDependent, updatedAt: new Date() });
    }

    async function loadDocuments(registration: Registration) {
        const documents = await Document.where({ registrationId: registration.id });
        return documents.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    function answer(document: Document, id: string) {
        return document.data.fieldAnswers.get(id)?.objectValue ?? null;
    }

    /**
     * Split documents carry their share, everything else the full amount; the originals always hold the total
     */
    function expectDocumentPrices(documents: Document[], total: number) {
        const active = documents.filter(d => d.status !== DocumentStatus.Deleted);
        expect(active.length).toBeGreaterThan(0);

        for (const document of active) {
            expect(answer(document, 'registration.priceOriginal')).toBe(total);
            expect(answer(document, 'registration.pricePaidOriginal')).toBe(total);
        }

        const split = active.filter(d => d.parentId !== null);
        const shares = split.map((_, index) => splitPrice(total, split.length, index)).sort();
        expect(split.map(d => answer(d, 'registration.price')).sort()).toEqual(shares);
        expect(split.map(d => answer(d, 'registration.pricePaid')).sort()).toEqual(shares);

        for (const document of active.filter(d => d.parentId === null)) {
            expect(answer(document, 'registration.price')).toBe(total);
            expect(answer(document, 'registration.pricePaid')).toBe(total);
        }
    }

    test('marking a second parent as tax dependent splits the existing document', async () => {
        const linda = parent('Linda', { nationalRegisterNumber: '93042012345', isMemberTaxDependent: true });
        const john = parent('John', { nationalRegisterNumber: '93042017297' });
        const { member, registration } = await createFamily([linda, john]);

        const [original] = await loadDocuments(registration);
        expect(original.parentId).toBeNull();
        expect(answer(original, 'debtor.firstName')).toBe('Linda');
        expectDocumentPrices([original], total);

        await patchParents(member, taxDependent(john, true));

        const documents = await loadDocuments(registration);
        expect(documents.length).toBe(2);

        const lindaDocument = documents.find(d => d.parentId === linda.id)!;
        const johnDocument = documents.find(d => d.parentId === john.id)!;
        expect(lindaDocument.id).toBe(original.id);
        expect(answer(lindaDocument, 'debtor.firstName')).toBe('Linda');
        expect(lindaDocument.data.description).toContain('(Linda Doe)');
        expect(answer(johnDocument, 'debtor.firstName')).toBe('John');
        expect(answer(johnDocument, 'debtor.nationalRegisterNumber')).toBe('93042017297');
        expect(johnDocument.data.description).toContain('(John Doe)');
        expect(documents.every(d => d.status === DocumentStatus.Published)).toBe(true);
        expectDocumentPrices(documents, total);
    });

    test('unmarking a parent merges the split documents back into one', async () => {
        const linda = parent('Linda', { nationalRegisterNumber: '93042012345', isMemberTaxDependent: true });
        const john = parent('John', { nationalRegisterNumber: '93042017297', isMemberTaxDependent: true });
        const { member, registration } = await createFamily([linda, john]);

        const splitDocuments = await loadDocuments(registration);
        expect(splitDocuments.length).toBe(2);
        expectDocumentPrices(splitDocuments, total);
        const lindaDocument = splitDocuments.find(d => d.parentId === linda.id)!;

        await patchParents(member, taxDependent(john, false));

        const documents = await loadDocuments(registration);
        expect(documents.length).toBe(1);
        expect(documents[0].id).toBe(lindaDocument.id);
        expect(documents[0].parentId).toBeNull();
        expect(answer(documents[0], 'debtor.firstName')).toBe('Linda');
        expect(documents[0].data.description).not.toContain('(Linda Doe)');
        expectDocumentPrices(documents, total);
    });

    test('unmarking a parent keeps a numbered document as deleted', async () => {
        const linda = parent('Linda', { nationalRegisterNumber: '93042012345', isMemberTaxDependent: true });
        const john = parent('John', { nationalRegisterNumber: '93042017297', isMemberTaxDependent: true });
        const { member, registration } = await createFamily([linda, john]);

        const splitDocuments = await loadDocuments(registration);
        const johnDocument = splitDocuments.find(d => d.parentId === john.id)!;
        johnDocument.number = 1;
        await johnDocument.save();

        await patchParents(member, taxDependent(john, false));

        const documents = await loadDocuments(registration);
        expect(documents.length).toBe(2);
        const deleted = documents.find(d => d.id === johnDocument.id)!;
        expect(deleted.status).toBe(DocumentStatus.Deleted);
        expect(deleted.number).toBe(1);
        expect(documents.find(d => d.parentId === null && d.status === DocumentStatus.Published)?.id).toBe(splitDocuments.find(d => d.parentId === linda.id)!.id);
        expectDocumentPrices(documents, total);
    });

    test('moving the tax dependency to the other parent moves the document', async () => {
        const linda = parent('Linda', { nationalRegisterNumber: '93042012345', isMemberTaxDependent: true });
        const john = parent('John', { nationalRegisterNumber: '93042017297' });
        const { member, registration } = await createFamily([linda, john]);
        const [original] = await loadDocuments(registration);

        await patchParents(member, taxDependent(linda, false), taxDependent(john, true));

        const documents = await loadDocuments(registration);
        expect(documents.length).toBe(1);
        expect(documents[0].id).toBe(original.id);
        expect(documents[0].parentId).toBeNull();
        expect(answer(documents[0], 'debtor.firstName')).toBe('John');
        expect(answer(documents[0], 'debtor.nationalRegisterNumber')).toBe('93042017297');
        expectDocumentPrices(documents, total);
    });

    test('changing the national register number of the debtor completes the document', async () => {
        const linda = parent('Linda', { isMemberTaxDependent: true });
        const john = parent('John', { nationalRegisterNumber: '93042017297' });
        const { member, registration } = await createFamily([linda, john]);

        const [original] = await loadDocuments(registration);
        expect(original.status).toBe(DocumentStatus.MissingData);
        expect(answer(original, 'debtor.nationalRegisterNumber')).toBeNull();

        await patchParents(member, Parent.patch({ id: linda.id, nationalRegisterNumber: '93042012345', updatedAt: new Date() }));

        const documents = await loadDocuments(registration);
        expect(documents.length).toBe(1);
        expect(documents[0].id).toBe(original.id);
        expect(documents[0].status).toBe(DocumentStatus.Published);
        expect(answer(documents[0], 'debtor.nationalRegisterNumber')).toBe('93042012345');
        expectDocumentPrices(documents, total);
    });

    test('changing the national register number of one of two debtors only completes that document', async () => {
        const linda = parent('Linda', { nationalRegisterNumber: '93042012345', isMemberTaxDependent: true });
        const john = parent('John', { isMemberTaxDependent: true });
        const { member, registration } = await createFamily([linda, john]);

        const before = await loadDocuments(registration);
        expect(before.find(d => d.parentId === linda.id)!.status).toBe(DocumentStatus.Published);
        expect(before.find(d => d.parentId === john.id)!.status).toBe(DocumentStatus.MissingData);

        await patchParents(member, Parent.patch({ id: john.id, nationalRegisterNumber: '93042017297', updatedAt: new Date() }));

        const documents = await loadDocuments(registration);
        expect(documents.map(d => d.id).sort()).toEqual(before.map(d => d.id).sort());
        const johnDocument = documents.find(d => d.parentId === john.id)!;
        expect(johnDocument.status).toBe(DocumentStatus.Published);
        expect(answer(johnDocument, 'debtor.nationalRegisterNumber')).toBe('93042017297');
        expectDocumentPrices(documents, total);
    });

    test('a document from before the split is claimed by the first debtor', async () => {
        const linda = parent('Linda', { nationalRegisterNumber: '93042012345', isMemberTaxDependent: true });
        const john = parent('John', { nationalRegisterNumber: '93042017297', isMemberTaxDependent: true });
        const member = await new MemberFactory({
            organization,
            details: MemberDetails.create({ firstName: 'Jane', lastName: 'Doe', birthDay: new Date(2015, 0, 1), parents: [linda, john] }),
        }).create();
        const registration = await new RegistrationFactory({ member, group }).create();
        await new BalanceItemFactory({ organizationId: organization.id, memberId: member.id, registrationId: registration.id, amount: 1, unitPrice: total, pricePaid: total }).create();

        // The state before certificates could be split: one document without a parent, already numbered
        const legacy = new Document();
        legacy.organizationId = organization.id;
        legacy.templateId = template.id;
        legacy.memberId = member.id;
        legacy.registrationId = registration.id;
        legacy.status = DocumentStatus.Published;
        legacy.number = 7;
        legacy.data = DocumentData.create({
            name: template.settings.name,
            fieldAnswers: new Map<string, RecordAnswer>([
                ['registration.price', RecordPriceAnswer.create({ settings: RecordSettings.create({ id: 'registration.price', type: RecordType.Price }), value: total })],
            ]),
        });
        await legacy.save();

        await patchMember(member, MemberDetails.patch({ firstName: 'Janet' }));

        const documents = await loadDocuments(registration);
        expect(documents.length).toBe(2);
        const claimed = documents.find(d => d.id === legacy.id)!;
        expect(claimed.parentId).toBe(linda.id);
        expect(claimed.number).toBe(7);
        expect(answer(claimed, 'debtor.firstName')).toBe('Linda');
        const created = documents.find(d => d.id !== legacy.id)!;
        expect(created.parentId).toBe(john.id);
        expect(answer(created, 'debtor.firstName')).toBe('John');
        expectDocumentPrices(documents, total);
    });

    test('a certificate that was split by hand is left alone', async () => {
        const linda = parent('Linda', { nationalRegisterNumber: '93042012345', isMemberTaxDependent: true });
        const john = parent('John', { nationalRegisterNumber: '93042017297' });
        const { member, registration } = await createFamily([linda, john]);
        const [original] = await loadDocuments(registration);

        // Duplicate the document in the dashboard and fill in the other parent by hand
        const reviewed = (answer: RecordAnswer) => {
            answer.markReviewed();
            return answer;
        };
        const duplicate = DocumentStruct.create({
            templateId: template.id,
            registrationId: registration.id,
            memberId: member.id,
            status: DocumentStatus.Draft,
            data: DocumentData.create({
                name: template.settings.name,
                description: original.data.description + ' (2)',
                fieldAnswers: new Map<string, RecordAnswer>([
                    ['debtor.firstName', reviewed(RecordTextAnswer.create({ settings: RecordSettings.create({ id: 'debtor.firstName', type: RecordType.Text }), value: 'John' }))],
                    ['debtor.nationalRegisterNumber', reviewed(RecordTextAnswer.create({ settings: RecordSettings.create({ id: 'debtor.nationalRegisterNumber', type: RecordType.Text }), value: '93042017297' }))],
                    ['registration.price', reviewed(RecordPriceAnswer.create({ settings: RecordSettings.create({ id: 'registration.price', type: RecordType.Price }), value: 6000 }))],
                ]),
            }),
        });
        const put = new PatchableArray() as PatchableArrayAutoEncoder<DocumentStruct>;
        put.addPut(duplicate);
        const request = Request.buildJson('PATCH', '/organization/documents', organization.getApiHost(), put);
        request.headers.authorization = 'Bearer ' + accessToken;
        const response = await testServer.test(new PatchDocumentEndpoint(), request);
        expect(response.status).toBe(200);
        const duplicateId = response.body[0].id;

        await patchParents(member, taxDependent(john, true));

        const documents = await loadDocuments(registration);
        expect(documents.map(d => d.id).sort()).toEqual([original.id, duplicateId].sort());
        expect(documents.every(d => d.parentId === null)).toBe(true);

        const originalAfter = documents.find(d => d.id === original.id)!;
        expect(originalAfter.data.description).toBe(original.data.description);
        expect(answer(originalAfter, 'debtor.firstName')).toBe('Linda');
        expectDocumentPrices([originalAfter], total);

        const duplicateAfter = documents.find(d => d.id === duplicateId)!;
        expect(duplicateAfter.data.description).toBe(original.data.description + ' (2)');
        expect(answer(duplicateAfter, 'debtor.firstName')).toBe('John');
        expect(answer(duplicateAfter, 'debtor.nationalRegisterNumber')).toBe('93042017297');
        expect(answer(duplicateAfter, 'registration.price')).toBe(6000);
        expect(answer(duplicateAfter, 'registration.priceOriginal')).toBe(total);
    });

    test('a template without debtor fields never splits', async () => {
        const otherGroup = await new GroupFactory({ organization }).create();
        const plainTemplate = await createFiscalTemplate(otherGroup, { withDebtor: false });
        const linda = parent('Linda', { nationalRegisterNumber: '93042012345', isMemberTaxDependent: true });
        const john = parent('John', { nationalRegisterNumber: '93042017297', isMemberTaxDependent: true });

        const member = await new MemberFactory({
            organization,
            details: MemberDetails.create({ firstName: 'Jane', lastName: 'Doe', birthDay: new Date(2015, 0, 1), parents: [linda, john] }),
        }).create();
        const registration = await new RegistrationFactory({ member, group: otherGroup }).create();
        await new BalanceItemFactory({ organizationId: organization.id, memberId: member.id, registrationId: registration.id, amount: 1, unitPrice: total, pricePaid: total }).create();
        await plainTemplate.buildAll();

        await patchMember(member, MemberDetails.patch({ firstName: 'Janet' }));

        const documents = await loadDocuments(registration);
        expect(documents.length).toBe(1);
        expect(documents[0].parentId).toBeNull();
        expect(documents[0].status).toBe(DocumentStatus.Published);
        expectDocumentPrices(documents, total);
    });
});
