import { DocumentStatus, NationalRegisterNumberOptOut, Parent } from '@stamhoofd/structures';
import { DocumentTemplateFactory } from '../factories/DocumentTemplateFactory.js';
import { getTaxDependentDebtors, splitPrice } from './DocumentTemplate.js';

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

describe('Model.getTaxDependentDebtors', () => {
    function parent({ name, isMemberTaxDependent, nationalRegisterNumber }: { name: string; isMemberTaxDependent?: boolean | null; nationalRegisterNumber?: string | typeof NationalRegisterNumberOptOut | null }) {
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
        const linda = parent({ name: 'Linda', isMemberTaxDependent: true, nationalRegisterNumber: '93042012345' });
        const john = parent({ name: 'John', nationalRegisterNumber: '93042017297' });

        expect(getTaxDependentDebtors([john, linda])).toEqual([{ debtor: linda, missingData: false }]);
    });

    // The certificate has to carry the name the family chose, even though it cannot be completed
    test('keeps a tax dependent parent that opted out, instead of falling back to another parent', () => {
        const linda = parent({ name: 'Linda', isMemberTaxDependent: true, nationalRegisterNumber: NationalRegisterNumberOptOut });
        const john = parent({ name: 'John', nationalRegisterNumber: '93042017297' });

        expect(getTaxDependentDebtors([linda, john])).toEqual([{ debtor: linda, missingData: true }]);
    });

    test('reports missing data when the tax dependent parent has no number yet', () => {
        const linda = parent({ name: 'Linda', isMemberTaxDependent: true });

        expect(getTaxDependentDebtors([linda])).toEqual([{ debtor: linda, missingData: true }]);
    });

    test('with co-parenting, both parents become a debtor in the order of the parents', () => {
        const linda = parent({ name: 'Linda', isMemberTaxDependent: true, nationalRegisterNumber: '93042012345' });
        const john = parent({ name: 'John', isMemberTaxDependent: true, nationalRegisterNumber: '93042017297' });

        expect(getTaxDependentDebtors([linda, john])).toEqual([{ debtor: linda, missingData: false }, { debtor: john, missingData: false }]);
    });

    test('with co-parenting, missing data is tracked per parent', () => {
        const linda = parent({ name: 'Linda', isMemberTaxDependent: true, nationalRegisterNumber: NationalRegisterNumberOptOut });
        const john = parent({ name: 'John', isMemberTaxDependent: true, nationalRegisterNumber: '93042017297' });

        expect(getTaxDependentDebtors([linda, john])).toEqual([{ debtor: linda, missingData: true }, { debtor: john, missingData: false }]);
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
