import { DocumentStatus, NationalRegisterNumberOptOut, Parent } from '@stamhoofd/structures';
import { DocumentTemplateFactory } from '../factories/DocumentTemplateFactory.js';
import { getTaxDependentDebtor } from './DocumentTemplate.js';

describe('Model.DocumentTemplate', () => {
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

describe('Model.getTaxDependentDebtor', () => {
    function parent({ name, taxDependent, nationalRegisterNumber }: { name: string; taxDependent?: boolean | null; nationalRegisterNumber?: string | typeof NationalRegisterNumberOptOut | null }) {
        return Parent.create({
            firstName: name,
            lastName: 'Doe',
            taxDependent: taxDependent ?? null,
            nationalRegisterNumber: nationalRegisterNumber ?? null,
        });
    }

    test('falls back to the old debtor logic when nobody has the member tax dependent', () => {
        const parents = [parent({ name: 'Linda', nationalRegisterNumber: '93042012345' })];

        expect(getTaxDependentDebtor(parents)).toBeNull();
    });

    test('picks the parent that has the member tax dependent', () => {
        const linda = parent({ name: 'Linda', taxDependent: true, nationalRegisterNumber: '93042012345' });
        const john = parent({ name: 'John', nationalRegisterNumber: '93042017297' });

        expect(getTaxDependentDebtor([john, linda])).toEqual({ debtor: linda, missingData: false });
    });

    // The certificate has to carry the name the family chose, even though it cannot be completed
    test('keeps a tax dependent parent that opted out, instead of falling back to another parent', () => {
        const linda = parent({ name: 'Linda', taxDependent: true, nationalRegisterNumber: NationalRegisterNumberOptOut });
        const john = parent({ name: 'John', nationalRegisterNumber: '93042017297' });

        expect(getTaxDependentDebtor([linda, john])).toEqual({ debtor: linda, missingData: true });
    });

    test('reports missing data when the tax dependent parent has no number yet', () => {
        const linda = parent({ name: 'Linda', taxDependent: true });

        expect(getTaxDependentDebtor([linda])).toEqual({ debtor: linda, missingData: true });
    });

    test('with co-parenting, prefers the one that can complete the certificate', () => {
        const linda = parent({ name: 'Linda', taxDependent: true, nationalRegisterNumber: NationalRegisterNumberOptOut });
        const john = parent({ name: 'John', taxDependent: true, nationalRegisterNumber: '93042017297' });

        expect(getTaxDependentDebtor([linda, john])).toEqual({ debtor: john, missingData: false });
    });

    test('with co-parenting, neither having a number is missing data', () => {
        const linda = parent({ name: 'Linda', taxDependent: true });
        const john = parent({ name: 'John', taxDependent: true });

        expect(getTaxDependentDebtor([linda, john])).toEqual({ debtor: linda, missingData: true });
    });
});
