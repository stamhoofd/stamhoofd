import { Member, MemberFactory, OrganizationFactory, backfillJudicialIdentityHashes, getJudicialIdentityHash } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';

/**
 * `members.judicialIdentityHash` is written by a `beforeSave` hook, so it is only right as long as every write
 * to a member's name or birth date goes through the model. Nothing bypasses it today - there is no raw UPDATE
 * against the name columns and no `Member.update()` builder anywhere - but a future write path that did would
 * leave the hash matching a name the member no longer has, which keeps an approval alive that should have
 * lapsed. That failure is silent, so this test recomputes the hash from the stored columns and insists the
 * database agrees.
 */
describe('members.judicialIdentityHash', () => {
    test('the stored hash matches the name and birth date the row actually holds', async () => {
        const organization = await new OrganizationFactory({}).create();

        const members = [
            await new MemberFactory({ organization, firstName: 'Nora', lastName: 'Peeters', birthDay: { year: 1990, month: 3, day: 10 } }).create(),
            await new MemberFactory({ organization, firstName: 'José', lastName: 'Ñuñez', birthDay: { year: 1985, month: 12, day: 31 } }).create(),
            await new MemberFactory({ organization, firstName: 'Jan-Pieter', lastName: 'van der Berg', birthDay: { year: 2001, month: 1, day: 1 } }).create(),
            await new MemberFactory({ organization, generateData: false }).create(),
        ];

        const rows = await SQL.select(
            SQL.column('members', 'id'),
            SQL.column('members', 'firstName'),
            SQL.column('members', 'lastName'),
            SQL.column('members', 'birthDay'),
            SQL.column('members', 'judicialIdentityHash'),
        )
            .from(SQL.table(Member.table))
            .where(SQL.column('members', 'id'), members.map(member => member.id))
            .fetch();

        expect(rows).toHaveLength(members.length);

        for (const row of rows) {
            const stored = row['members'] as { id: string; firstName: string | null; lastName: string | null; birthDay: string | null; judicialIdentityHash: string | null };

            expect(stored.judicialIdentityHash, `member ${stored.id} has no hash`).not.toBeNull();
            expect(stored.judicialIdentityHash, `the hash of member ${stored.id} does not match its own columns`)
                .toBe(getJudicialIdentityHash(stored));
        }
    });

    test('renaming a member changes the hash, so an approval granted to the old name stops matching', async () => {
        const organization = await new OrganizationFactory({}).create();
        const member = await new MemberFactory({ organization, firstName: 'Nora', lastName: 'Peeters', birthDay: { year: 1990, month: 3, day: 10 } }).create();

        const before = await selectHash(member.id);

        member.details.lastName = 'Peeters-Janssens';
        await member.save();

        expect(await selectHash(member.id)).not.toBe(before);
    });

    test('a correction that only changes capitalisation still changes the hash', async () => {
        const organization = await new OrganizationFactory({}).create();
        const member = await new MemberFactory({ organization, firstName: 'jan', lastName: 'Peeters', birthDay: { year: 1990, month: 3, day: 10 } }).create();

        const before = await selectHash(member.id);

        member.details.firstName = 'Jan';
        await member.save();

        expect(await selectHash(member.id)).not.toBe(before);
    });
});

describe('backfilling members.judicialIdentityHash', () => {
    test('fills the hash of a member that predates the column, and leaves the rest alone', async () => {
        const organization = await new OrganizationFactory({}).create();
        const member = await new MemberFactory({ organization, firstName: 'Nora', lastName: 'Peeters', birthDay: { year: 1990, month: 3, day: 10 } }).create();
        const untouched = await new MemberFactory({ organization, firstName: 'Jan', lastName: 'Janssens', birthDay: { year: 1991, month: 4, day: 11 } }).create();

        const expected = await selectHash(member.id);
        const untouchedBefore = await selectHash(untouched.id);

        // What a row that existed before this column did looks like
        await SQL.update(Member.table).set('judicialIdentityHash', null).where('id', member.id).update();
        expect(await selectHash(member.id)).toBeNull();

        const updated = await backfillJudicialIdentityHashes();

        expect(updated).toBeGreaterThanOrEqual(1);
        expect(await selectHash(member.id)).toBe(expected);
        expect(await selectHash(untouched.id)).toBe(untouchedBefore);
    });
});

async function selectHash(memberId: string): Promise<string | null> {
    const rows = await SQL.select(SQL.column('members', 'judicialIdentityHash'))
        .from(SQL.table(Member.table))
        .where(SQL.column('members', 'id'), memberId)
        .fetch();

    return rows[0]['members']['judicialIdentityHash'] as string | null;
}
