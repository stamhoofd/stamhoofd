import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import type { MemberDetails } from '@stamhoofd/structures';
import { StringCompare } from '@stamhoofd/utility';

/**
 * Prevents non platform-admins from drastically changing the identity of an existing member.
 *
 * Fully overwriting the name or birth date of a member can be abused to 'merge' a member into
 * another one (e.g. a parent changing the data of one child so it becomes identical to a sibling),
 * which is hard to undo afterwards.
 *
 * Allowed changes (that do NOT throw):
 * - Fixing a typo in the first name (small edit distance)
 * - Changing the last name (fully allowed, e.g. after a marriage or a spelling correction)
 * - A small correction to the birth date: changing the day, month or year, but not all three at once
 *
 * Platform admins with full access are not restricted; callers should only run this check when the
 * user does not have platform full access.
 */
export function throwIfDrasticMemberDetailsChange(patch: MemberDetails | AutoEncoderPatchType<MemberDetails>, originalDetails: MemberDetails) {
    // First name: only allow typo-level corrections. A completely different first name is not allowed.
    if (patch.firstName !== undefined && patch.firstName !== originalDetails.firstName) {
        const typoCount = StringCompare.typoCount(originalDetails.firstName, patch.firstName);

        // Allow a change of at most ~40% of the (shortest) name, with a minimum of one character,
        // so short names can still have a typo corrected.
        const maxTypos = Math.max(1, Math.floor(0.4 * Math.min(originalDetails.firstName.length, patch.firstName.length)));

        if (typoCount > maxTypos) {
            throw new SimpleError({
                code: 'not_allowed',
                message: 'Drastic first name change is not allowed',
                human: $t(`%Zbq`),
                field: 'firstName',
            });
        }
    }

    // Birth date: only allow a small correction. Changing the day, month and year all at once is not allowed.
    const originalBirthDay = originalDetails.birthDay;
    const newBirthDay = patch.birthDay;

    if (newBirthDay !== undefined && newBirthDay !== null && originalBirthDay !== null) {
        const dayChanged = newBirthDay.getDate() !== originalBirthDay.getDate();
        const monthChanged = newBirthDay.getMonth() !== originalBirthDay.getMonth();
        const yearChanged = newBirthDay.getFullYear() !== originalBirthDay.getFullYear();

        if (dayChanged && monthChanged && yearChanged) {
            throw new SimpleError({
                code: 'not_allowed',
                message: 'Drastic birth date change is not allowed',
                human: $t(`%Zbr`),
                field: 'birthDay',
            });
        }
    }
}
