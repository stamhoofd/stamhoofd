import { Migration } from '@simonbackx/simple-database';
import { Member, mergeMultipleMembers } from '@stamhoofd/models';
import type { SQLExpression } from '@stamhoofd/sql';
import { scalarToSQLExpression, SQL, SQLAlias, SQLSelectAs, SQLWhereEqual, SQLWhereSign } from '@stamhoofd/sql';
import { LoggingTools } from '../helpers/LoggingTools.js';
import { SeedTools } from '../helpers/SeedTools.js';

// should be run before any migration where a member is saved
export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName.toLowerCase() !== 'stamhoofd') {
        console.log('skipped for platform (only runs for Stamhoofd): ' + STAMHOOFD.platformName);
        return;
    }

    await migrateDuplicateMemberNumbers({
        dryRun: false,
        doLog: true,
    });
});

async function migrateDuplicateMemberNumbers({ dryRun, doLog }: { dryRun: boolean; doLog: boolean }) {
    // first get all duplicate numbers (if the number is not duplicate it should not be removed, even if invalid)
    const duplicateMemberNumbers = await getDuplicateMemberNumbers();
    const invalidNumbers = new Set<string>();
    const validNumbers = new Set<string>();

    for (const number of duplicateMemberNumbers.values()) {
        const isValid = isValidNumber(number);
        if (isValid) {
            validNumbers.add(number);
        } else {
            invalidNumbers.add(number);
        }
    }

    const testRemoved = new Set<string>();

    const duplicateMembers = new Map<string, Member[]>();
    const memberBatchProcessor = SeedTools.createBatchProcessor({
        batchSize: 1000,
        action: async (member: Member) => {
            const memberNumber = member.details.memberNumber;

            if (memberNumber !== null) {
            // only remove if duplicate
                if (invalidNumbers.has(memberNumber)) {
                    if (doLog) {
                        testRemoved.add(memberNumber);
                    // console.log(`Remove invalid member number: ${memberNumber} (memberId: ${member.id})`);
                    }

                    // remove number
                    member.details.memberNumber = null;
                    member.memberNumber = null;
                    if (!dryRun) {
                        await member.save();
                    }
                    return;
                }

                if (validNumbers.has(memberNumber)) {
                // add to duplicate members
                    const duplicates = duplicateMembers.get(memberNumber) ?? [];
                    duplicates.push(member);
                    duplicateMembers.set(memberNumber, duplicates);
                }
            }
        },
    });

    const progressLogger = await LoggingTools.createProgressLoggerFromQuery(Member.select(), { tag: 'Remove' });
    memberBatchProcessor.setProgressLogger(progressLogger);

    // loop all members
    for await (const member of Member.select().all()) {
        await memberBatchProcessor.execute(member);
    }

    const mergeBatchProcessor = SeedTools.createBatchProcessor({
        batchSize: 100,
        action: async ([number, members]: [string, Member[]]) => {
            if (members.length < 2) {
                return;
            }

            const areSame = areSameMembers(members);
            if (areSame) {
                if (doLog) {
                    console.log(`Merge duplicate member number: ${number} (memberIds: ${members.map(m => m.id).join(', ')})`);
                }
                if (!dryRun) {
                    await mergeMultipleMembers(members);
                }
            } else {
                if (doLog) {
                    console.log('Duplicate member numbers are not the same: ' + members.map(m => m.details.name).join(', '));
                }

                await removeMemberNumbersOfNotRecentUpdatedMembers(members, { doLog, dryRun });
            }
        },
    });

    mergeBatchProcessor.setProgressLogger(LoggingTools.createProgressLogger(duplicateMembers.size, { tag: 'Merge' }));

    // merge duplicate members
    for (const entry of duplicateMembers) {
        await mergeBatchProcessor.execute(entry);
    }

    // check if there are still duplicate member numbers
    const remainingDuplicateMemberNumbers = await getDuplicateMemberNumbers();

    if (remainingDuplicateMemberNumbers.size > 0) {
        throw new Error('Duplicate member numbers not removed: ' + [...remainingDuplicateMemberNumbers.values()].join(', '));
    }
}

/**
 * Members are the same if they have the same first and last name (at leat for this migration)
 * @param members
 * @returns
 */
function areSameMembers(members: Member[]) {
    const firstMember = members[0];
    const firstName = normalizeName(firstMember.firstName);
    const lastName = normalizeName(firstMember.lastName);
    const organizationId = firstMember.organizationId;

    if (firstName.length < 3 || lastName.length < 3) {
        return false;
    }

    return members.every(m => normalizeName(m.firstName) === firstName && normalizeName(m.lastName) === lastName && m.organizationId === organizationId);
}

function normalizeName(name: string) {
    return name.trim().toLowerCase();
}

async function removeMemberNumbersOfNotRecentUpdatedMembers(members: Member[], { doLog, dryRun }: { doLog: boolean; dryRun: boolean }) {
    if (members.length < 2) {
        return;
    }
    const sorted = members.slice().sort((m1, m2) => m2.updatedAt.getTime() - m1.updatedAt.getTime());

    // keep memberNumber of most recent updated member
    const keep = sorted.shift();
    if (!keep) {
        return;
    }

    if (doLog) {
        console.log(`Keep memberNumber of member with id: ${keep.id} (updatedAt: ${keep.updatedAt.toString()})`);
    }

    for (const member of sorted) {
        if (doLog) {
            console.log(`Remove memberNumber of member with id: ${member.id} (updatedAt: ${member.updatedAt.toString()})`);
        }

        member.details.memberNumber = null;
        member.memberNumber = null;

        if (!dryRun) {
            await member.save();
        }
    }
}

async function getDuplicateMemberNumbers(): Promise<Set<string>> {
    const countColumn: SQLExpression = SQL.aggregateColumn('COUNT', SQL.jsonValue(SQL.column('details'), '$.value.memberNumber'));

    const namespace = 'members';
    const resultName = 'memberNumber';

    const test = new SQLSelectAs(SQL.jsonValue(SQL.column('details'), '$.value.memberNumber'), new SQLAlias(`${namespace}__${resultName}`));

    const query = SQL.select(test)
        .from('members')
        .groupBy(SQL.column('organizationId'), SQL.jsonValue(SQL.column('details'), '$.value.memberNumber'))
        .having(new SQLWhereEqual(countColumn, SQLWhereSign.Greater, scalarToSQLExpression(1)));

    const result = await query.fetch();

    const allMemberNumbers: string[] = result.map(r => r?.[namespace]?.[resultName]?.toString() ?? '');
    return new Set(allMemberNumbers);
}

function isValidNumber(value: string): boolean {
    const normalized = value.toString().toLowerCase();

    // all duplicate short numbers are assigned to multiple different members -> these cannot be valid
    if (normalized.length < 4) {
        return false;
    }

    if (/[a-z]/i.test(normalized)) {
        return false;
    }

    return true;
}
