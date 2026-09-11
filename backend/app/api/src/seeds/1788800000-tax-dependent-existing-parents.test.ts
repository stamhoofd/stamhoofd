import { Member } from '@stamhoofd/models';
import { MemberDetails, NationalRegisterNumberOptOut, Parent } from '@stamhoofd/structures';
import { markSingleTaxDependentParent } from './1788800000-tax-dependent-existing-parents.js';

function buildMember(parents: Parent[]) {
    const member = new Member();
    member.details = MemberDetails.create({ firstName: 'Child', lastName: 'Doe', parents });
    return member;
}

describe('Seed.markSingleTaxDependentParent', () => {
    test('marks the only parent with a national register number', () => {
        const withNumber = Parent.create({ firstName: 'Linda', lastName: 'Doe', nationalRegisterNumber: '93042012345' });
        const without = Parent.create({ firstName: 'John', lastName: 'Doe' });
        const member = buildMember([withNumber, without]);

        expect(markSingleTaxDependentParent(member)).toBe(true);
        expect(withNumber.taxDependent).toBe(true);
        expect(without.taxDependent).toBeNull();
    });

    test('leaves it to the family when both parents have one', () => {
        const a = Parent.create({ firstName: 'Linda', lastName: 'Doe', nationalRegisterNumber: '93042012345' });
        const b = Parent.create({ firstName: 'John', lastName: 'Doe', nationalRegisterNumber: '93042017297' });

        expect(markSingleTaxDependentParent(buildMember([a, b]))).toBe(false);
        expect(a.taxDependent).toBeNull();
        expect(b.taxDependent).toBeNull();
    });

    test('ignores an opt-out as a national register number', () => {
        const optOut = Parent.create({ firstName: 'Linda', lastName: 'Doe', nationalRegisterNumber: NationalRegisterNumberOptOut });
        const withNumber = Parent.create({ firstName: 'John', lastName: 'Doe', nationalRegisterNumber: '93042017297' });

        expect(markSingleTaxDependentParent(buildMember([optOut, withNumber]))).toBe(true);
        expect(withNumber.taxDependent).toBe(true);
        expect(optOut.taxDependent).toBeNull();
    });

    test('does nothing without any national register number', () => {
        const parent = Parent.create({ firstName: 'Linda', lastName: 'Doe' });
        expect(markSingleTaxDependentParent(buildMember([parent]))).toBe(false);
        expect(parent.taxDependent).toBeNull();
    });

    test('never overrides an answer the family already gave', () => {
        const parent = Parent.create({ firstName: 'Linda', lastName: 'Doe', nationalRegisterNumber: '93042012345', taxDependent: false });
        expect(markSingleTaxDependentParent(buildMember([parent]))).toBe(false);
        expect(parent.taxDependent).toBe(false);
    });
});
