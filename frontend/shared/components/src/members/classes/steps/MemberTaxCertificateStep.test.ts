import { NationalRegisterNumberOptOut, Parent, ParentType } from '@stamhoofd/structures';
import { describe, expect, test } from 'vitest';
import type { TaxCertificateMemberOptions } from '../../testing/createTaxCertificateMember';
import { createTaxCertificateMember } from '../../testing/createTaxCertificateMember';
import type { MemberStepManager } from '../MemberStepManager';
import { MemberTaxCertificateStep } from './MemberTaxCertificateStep';

const VALID_NRN = '93.04.20-001.22';
const MEMBER_NRN = '15.04.20-001.62';
const THREE_MONTHS = 60 * 1000 * 60 * 24 * 31 * 3;

function mother(options: { isMemberTaxDependent?: boolean | null; nationalRegisterNumber?: string | null } = {}) {
    return Parent.create({
        firstName: 'Moeder',
        lastName: 'Doe',
        type: ParentType.Mother,
        isMemberTaxDependent: options.isMemberTaxDependent ?? null,
        nationalRegisterNumber: options.nationalRegisterNumber ?? null,
    });
}

/** Complete data: the member has a number, and so does the parent that has the member tax dependent */
const complete: TaxCertificateMemberOptions = {
    nationalRegisterNumber: MEMBER_NRN,
    parents: [mother({ isMemberTaxDependent: true, nationalRegisterNumber: VALID_NRN })],
};

function isEnabled(options: TaxCertificateMemberOptions, outdatedTime: number | null = null, reviewedAt?: Date) {
    const { member } = createTaxCertificateMember(options);

    if (reviewedAt) {
        member.patchedMember.details.reviewTimes.markReviewed('taxCertificates', reviewedAt);
    }

    const manager = { member, context: { user: null } } as unknown as MemberStepManager;
    return new MemberTaxCertificateStep({ outdatedTime }).isEnabled(manager);
}

describe('MemberTaxCertificateStep.isEnabled', () => {
    test('asked when nobody has the member tax dependent', () => {
        expect(isEnabled({ nationalRegisterNumber: MEMBER_NRN, parents: [mother()] })).toBe(true);
    });

    test('asked when the debtor has no number', () => {
        expect(isEnabled({ nationalRegisterNumber: MEMBER_NRN, parents: [mother({ isMemberTaxDependent: true })] })).toBe(true);
    });

    test('asked when the member has no number', () => {
        expect(isEnabled({ parents: [mother({ isMemberTaxDependent: true, nationalRegisterNumber: VALID_NRN })] })).toBe(true);
    });

    test('skipped when everything is filled in', () => {
        expect(isEnabled(complete)).toBe(false);
    });

    test('skipped when the member opted out of a national register number', () => {
        expect(isEnabled({ nationalRegisterNumber: NationalRegisterNumberOptOut, parents: [mother()] })).toBe(false);
    });

    test('skipped without parents', () => {
        expect(isEnabled({ parents: [] })).toBe(false);
    });

    test('skipped when the member is too old for a certificate', () => {
        expect(isEnabled({ age: 17, parents: [mother()] })).toBe(false);
    });

    describe('when the organization does not collect tax certificates', () => {
        test('skipped, even with missing data', () => {
            expect(isEnabled({ taxCertificates: false, parents: [mother()] })).toBe(false);
        });

        // The step is part of every registration in the member portal, which checks for outdated reviews
        test('skipped, even though the section was never reviewed', () => {
            expect(isEnabled({ taxCertificates: false, parents: [mother()] }, THREE_MONTHS)).toBe(false);
        });
    });

    describe('review time', () => {
        test('asked again when the review is outdated', () => {
            const fourMonthsAgo = new Date(Date.now() - THREE_MONTHS - 24 * 60 * 60 * 1000);
            expect(isEnabled(complete, THREE_MONTHS, fourMonthsAgo)).toBe(true);
        });

        test('skipped when reviewed recently', () => {
            expect(isEnabled(complete, THREE_MONTHS, new Date())).toBe(false);
        });

        test('asked when never reviewed', () => {
            expect(isEnabled(complete, THREE_MONTHS)).toBe(true);
        });
    });
});
