import { Formatter } from '@stamhoofd/utility';
import { createHash } from 'crypto';

/**
 * The identity an approval of a judicial record extract was granted to.
 *
 * The one definition of this hash. `members.judicialIdentityHash` is written from it on every save and a
 * judicial record copies that stored value, so nothing recomputes it and there is no second implementation to
 * keep in step. Comparing the two answers "is this still the person who was approved?".
 *
 * It is deliberately exact: accents, capitalisation and spacing all change the hash, and that is the
 * requirement rather than a limitation. Any edit to a member's name or birth date asks them for a new extract.
 *
 * There is no version column, so this serialisation is frozen. Folding anything away later - accents, case,
 * punctuation - would not reduce future renewals; it would invalidate every approval in existence the moment
 * it shipped, and a member's former name is gone, so no migration could put them back.
 *
 * `birthDay` is serialised the way `members.birthDay` already stores it, as an ISO date.
 */
export function getJudicialIdentityHash({ firstName, lastName, birthDay }: {
    firstName: string | null;
    lastName: string | null;
    birthDay: Date | string | null;
}): string {
    const birthDayValue = birthDay === null
        ? ''
        : (typeof birthDay === 'string' ? birthDay : Formatter.dateIso(birthDay));

    // The separator is what stops 'AB' + 'C' hashing equal to 'A' + 'BC'. An absent field is an empty segment
    // rather than a skipped one, so a member without a first name cannot shift the others one place left.
    const serialized = [firstName ?? '', lastName ?? '', birthDayValue].join('|');

    return createHash('sha256').update(serialized, 'utf8').digest('hex');
}
