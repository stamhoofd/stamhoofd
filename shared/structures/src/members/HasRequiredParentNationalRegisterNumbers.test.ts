import { Organization } from '../Organization.js';
import { Platform } from '../Platform.js';
import { MemberDetails } from './MemberDetails.js';
import { MemberWithRegistrationsBlob } from './MemberWithRegistrationsBlob.js';
import { NationalRegisterNumberOptOut } from './NationalRegisterNumberOptOut.js';
import { Parent } from './Parent.js';
import { PlatformFamily, PlatformMember } from './PlatformMember.js';

describe('PlatformMember.hasRequiredParentNationalRegisterNumbers', () => {
    function build(parents: Parent[], nationalRegisterNumber: string | typeof NationalRegisterNumberOptOut | null = null) {
        const organization = Organization.create({});
        const member = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({ firstName: 'Child', lastName: 'Doe', parents, nationalRegisterNumber }),
        });
        const family = new PlatformFamily({ platform: Platform.create({}), contextOrganization: organization });
        return new PlatformMember({ member, family });
    }

    function parent({ isMemberTaxDependent, nationalRegisterNumber }: { isMemberTaxDependent: boolean | null; nationalRegisterNumber?: string | typeof NationalRegisterNumberOptOut | null }) {
        return Parent.create({
            firstName: 'Parent',
            lastName: 'Doe',
            isMemberTaxDependent,
            nationalRegisterNumber: nationalRegisterNumber ?? null,
        });
    }

    test('false when nobody has the member tax dependent', () => {
        expect(build([parent({ isMemberTaxDependent: null })]).hasRequiredParentNationalRegisterNumbers).toBe(false);
    });

    test('false when only a parent that is not tax dependent has a number', () => {
        expect(build([
            parent({ isMemberTaxDependent: null, nationalRegisterNumber: '93042000122' }),
            parent({ isMemberTaxDependent: null }),
        ]).hasRequiredParentNationalRegisterNumbers).toBe(false);
    });

    test('false when the tax dependent parent has no number, even if another parent does', () => {
        expect(build([
            parent({ isMemberTaxDependent: null, nationalRegisterNumber: '93042000122' }),
            parent({ isMemberTaxDependent: true }),
        ]).hasRequiredParentNationalRegisterNumbers).toBe(false);
    });

    test('true when the tax dependent parent has a number', () => {
        expect(build([
            parent({ isMemberTaxDependent: true, nationalRegisterNumber: '93042000122' }),
            parent({ isMemberTaxDependent: null }),
        ]).hasRequiredParentNationalRegisterNumbers).toBe(true);
    });

    test('an opt-out counts as answered', () => {
        expect(build([
            parent({ isMemberTaxDependent: true, nationalRegisterNumber: NationalRegisterNumberOptOut }),
        ]).hasRequiredParentNationalRegisterNumbers).toBe(true);
    });

    // Without a Belgian number of their own the member gets no certificate, so no parent number is needed either
    test('true when the member opted out, whatever the parents hold', () => {
        expect(build([parent({ isMemberTaxDependent: null })], NationalRegisterNumberOptOut).hasRequiredParentNationalRegisterNumbers).toBe(true);
        expect(build([parent({ isMemberTaxDependent: true })], NationalRegisterNumberOptOut).hasRequiredParentNationalRegisterNumbers).toBe(true);
    });

    test('a number of the member itself does not answer the question', () => {
        expect(build([parent({ isMemberTaxDependent: true })], '15042000162').hasRequiredParentNationalRegisterNumbers).toBe(false);
    });

    test('with co-parenting both parents need their own number', () => {
        expect(build([
            parent({ isMemberTaxDependent: true, nationalRegisterNumber: '93042000122' }),
            parent({ isMemberTaxDependent: true }),
        ]).hasRequiredParentNationalRegisterNumbers).toBe(false);

        expect(build([
            parent({ isMemberTaxDependent: true, nationalRegisterNumber: '93042000122' }),
            parent({ isMemberTaxDependent: true, nationalRegisterNumber: '93042000221' }),
        ]).hasRequiredParentNationalRegisterNumbers).toBe(true);
    });
});
