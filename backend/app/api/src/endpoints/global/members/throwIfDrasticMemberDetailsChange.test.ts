import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { isSimpleError } from '@simonbackx/simple-errors';
import { MemberDetails } from '@stamhoofd/structures';
import { throwIfDrasticMemberDetailsChange } from './throwIfDrasticMemberDetailsChange.js';

/**
 * Runs the check and returns the thrown SimpleError (as { code, field }), or null when nothing was thrown.
 */
function runCheck(patch: AutoEncoderPatchType<MemberDetails>, original: MemberDetails): { code: string; field?: string } | null {
    try {
        throwIfDrasticMemberDetailsChange(patch, original);
        return null;
    } catch (e) {
        if (isSimpleError(e)) {
            return { code: e.code, field: e.field };
        }
        throw e;
    }
}

describe('throwIfDrasticMemberDetailsChange', () => {
    const original = MemberDetails.create({
        firstName: 'Thomas',
        lastName: 'Peeters',
        birthDay: new Date(2010, 4, 15), // 15 May 2010
    });

    describe('First name', () => {
        test('An unchanged first name is allowed', () => {
            expect(runCheck(MemberDetails.patch({ firstName: 'Thomas' }), original)).toBeNull();
        });

        test('A case-only change is allowed (normalized)', () => {
            expect(runCheck(MemberDetails.patch({ firstName: 'thomas' }), original)).toBeNull();
        });

        test('Fixing a typo is allowed', () => {
            expect(runCheck(MemberDetails.patch({ firstName: 'Tomas' }), original)).toBeNull();
        });

        test('A short name with a single typo is allowed', () => {
            const jan = MemberDetails.create({ firstName: 'Jan', lastName: 'Peeters', birthDay: new Date(2010, 4, 15) });
            expect(runCheck(MemberDetails.patch({ firstName: 'Jana' }), jan)).toBeNull();
        });

        test('Completely changing the first name is not allowed', () => {
            expect(runCheck(MemberDetails.patch({ firstName: 'Wannes' }), original)).toMatchObject({ code: 'not_allowed', field: 'firstName' });
        });

        test('Swapping a short first name for a different one is not allowed', () => {
            const jan = MemberDetails.create({ firstName: 'Jan', lastName: 'Peeters', birthDay: new Date(2010, 4, 15) });
            expect(runCheck(MemberDetails.patch({ firstName: 'Tom' }), jan)).toMatchObject({ code: 'not_allowed', field: 'firstName' });
        });
    });

    describe('Last name', () => {
        test('Completely changing the last name is allowed', () => {
            expect(runCheck(MemberDetails.patch({ lastName: 'Janssens' }), original)).toBeNull();
        });
    });

    describe('Birth date', () => {
        test('Changing only the year is allowed', () => {
            expect(runCheck(MemberDetails.patch({ birthDay: new Date(2011, 4, 15) }), original)).toBeNull();
        });

        test('Changing only the day is allowed', () => {
            expect(runCheck(MemberDetails.patch({ birthDay: new Date(2010, 4, 16) }), original)).toBeNull();
        });

        test('Changing only the month is allowed', () => {
            expect(runCheck(MemberDetails.patch({ birthDay: new Date(2010, 5, 15) }), original)).toBeNull();
        });

        test('Changing two components is allowed', () => {
            expect(runCheck(MemberDetails.patch({ birthDay: new Date(2010, 5, 16) }), original)).toBeNull();
        });

        test('Changing day, month and year all at once is not allowed', () => {
            expect(runCheck(MemberDetails.patch({ birthDay: new Date(2012, 7, 20) }), original)).toMatchObject({ code: 'not_allowed', field: 'birthDay' });
        });

        test('Setting a birth date for the first time is allowed', () => {
            const noBirthDay = MemberDetails.create({ firstName: 'Thomas', lastName: 'Peeters', birthDay: null });
            expect(runCheck(MemberDetails.patch({ birthDay: new Date(2012, 7, 20) }), noBirthDay)).toBeNull();
        });

        test('Clearing the birth date is allowed', () => {
            expect(runCheck(MemberDetails.patch({ birthDay: null }), original)).toBeNull();
        });
    });

    test('An unrelated patch is allowed', () => {
        expect(runCheck(MemberDetails.patch({ email: 'someone@example.com' }), original)).toBeNull();
    });
});
