import { Migration, SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { Member, mergeTwoMembers } from '@stamhoofd/models';
import { SQL, SQLSelect } from '@stamhoofd/sql';
import { PatchOrganizationMembersEndpoint } from '../endpoints/global/members/PatchOrganizationMembersEndpoint.js';

type MergeType = {
    a: {
        id: string;
        firstName: string;
        lastName: string;
        createdAt: Date;
    };
    b: {
        id: string;
        createdAt: Date;
    };
};

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    const q = new SQLSelect(
        (row: SQLResultNamespacedRow): MergeType => {
            return {
                a: {
                    id: row['a'].id as string,
                    firstName: row['a'].firstName as string,
                    lastName: row['a'].lastName as string,
                    createdAt: row['a'].createdAt as Date,
                },
                b: {
                    id: row['b'].id as string,
                    createdAt: row['b'].createdAt as Date,
                },
            };
        },
        SQL.wildcard('a'),
        SQL.wildcard('b'),
    )
        .from(Member.table, 'a')
        .join(
            SQL.join(Member.table, 'b')
                .where(
                    SQL.column('b', 'id'),
                    '!=',
                    SQL.column('a', 'id'),
                )
                .andWhere(
                    SQL.column('b', 'firstName'),
                    SQL.column('a', 'firstName'),
                )
                .andWhere(
                    SQL.column('b', 'lastName'),
                    SQL.column('a', 'lastName'),
                )
                .andWhere(
                    SQL.column('b', 'birthDay'),
                    SQL.column('a', 'birthDay'),
                ),
        )
        .where(
            SQL.where(
                SQL.column('a', 'createdAt'),
                '<',
                SQL.column('b', 'createdAt'),
            ).or(
                SQL.where(
                    SQL.column('b', 'createdAt'),
                    SQL.column('a', 'createdAt'),
                ).and(
                    SQL.column('a', 'id'),
                    '<',
                    SQL.column('b', 'id'),
                ),
            ),
        )
        .orderBy(
            SQL.column('a', 'createdAt'),
            'ASC',
        );

    if (STAMHOOFD.userMode === 'organization') {
        q.where(
            SQL.column('b', 'organizationId'),
            SQL.column('organizationId'),
        );
    }

    const duplicates = await q.fetch();

    const deletedSet = new Set<string>();
    const mergedIntoSet = new Set<string>();

    for (const duplicate of duplicates) {
        if (mergedIntoSet.has(duplicate.b.id)) {
            console.log('Found chained duplicate in wrong order', duplicate.a.id, 'and', duplicate.b.id);
            continue; // Already merged this one
        }

        if (deletedSet.has(duplicate.b.id)) {
            continue; // Already deleted this one
        }

        if (deletedSet.has(duplicate.a.id)) {
            console.log('Skipping duplicate', duplicate.a.id, 'because it was already deleted');
            continue; // Already deleted this one
        }

        console.log(
            'Found duplicate member',
            duplicate.a.id,
            duplicate.a.createdAt,
            'and',
            duplicate.b.id,
            duplicate.b.createdAt,
            'with name',
            duplicate.a.firstName, duplicate.a.lastName);
        deletedSet.add(duplicate.b.id);
        mergedIntoSet.add(duplicate.a.id);

        // Run the merge
        const [memberA] = await Member.getBlobByIds(duplicate.a.id);
        const [memberB] = await Member.getBlobByIds(duplicate.b.id);

        if (memberA.details.name !== memberB.details.name) {
            console.warn('Member names do not match', memberA.details.name, 'and', memberB.details.name);
            continue; // Names do not match, cannot merge
        }

        if (memberA.details.birthDayFormatted === null || memberA.details.birthDayFormatted !== memberB.details.birthDayFormatted) {
            console.warn('Member birthday do not match', memberA.details.birthDayFormatted, 'and', memberB.details.birthDayFormatted);
            continue; // Names do not match, cannot merge
        }

        if (!PatchOrganizationMembersEndpoint.shouldCheckIfMemberIsDuplicate(memberA)) {
            console.log('Skipping merge because not eligible for duplicate check');
            continue;
        }

        await mergeTwoMembers(memberA, memberB);
    }
});
