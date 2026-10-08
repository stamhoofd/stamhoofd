import { CachedBalance, Member, Registration } from '@stamhoofd/models';
import type { SQLNamedExpression } from '@stamhoofd/sql';
import { SQL, SQLAlias, SQLSelectAs, SQLSum } from '@stamhoofd/sql';

type SQLJoin = ReturnType<typeof SQL.leftJoin>;

const memberCachedBalanceJoinCache = new Map<string, SQLJoin>();

export const memberCachedBalanceForOrganizationJoin = SQL.leftJoin(
    SQL.select('objectId', 'organizationId',
        new SQLSelectAs(
            new SQLSum(
                SQL.column('amountOpen'),
            ),
            new SQLAlias('amountOpen'),
        ),
    )
        .from(CachedBalance.table)
        .where(SQL.column(CachedBalance.table, 'objectType'), 'member')
        .groupBy(SQL.column(CachedBalance.table, 'objectId'), SQL.column(CachedBalance.table, 'organizationId'))
        .as('memberCachedBalance') as SQLNamedExpression,
    'memberCachedBalance',
)
    .where(SQL.column('objectId'), SQL.column(Registration.table, 'memberId'))
    .andWhere(SQL.column('organizationId'), SQL.column(Registration.table, 'organizationId'));

/**
 * Joins the outstanding balance a member has at one organization as `memberCachedBalance.amountOpen`.
 * The join is cached per organization because SQLSelect dedupes joins by reference: the sorter and the
 * pagination filter must hand over the same object or the query would join the same alias twice.
 */
export function memberCachedBalanceJoinForOrganization(organizationId: string): SQLJoin {
    const cached = memberCachedBalanceJoinCache.get(organizationId);
    if (cached) {
        return cached;
    }

    // (organizationId, objectId, objectType) is unique, so this yields at most one row per member
    const join = SQL.leftJoin(CachedBalance.table, 'memberCachedBalance')
        .where(SQL.column('objectId'), SQL.column(Member.table, 'id'))
        .andWhere(SQL.column('objectType'), 'member')
        .andWhere(SQL.column('organizationId'), organizationId);

    memberCachedBalanceJoinCache.set(organizationId, join);
    return join;
}

export const registrationCachedBalanceJoin = SQL.leftJoin(
    SQL.select('objectId', 'organizationId',
        new SQLSelectAs(
            new SQLSum(
                SQL.calculation(SQL.column('amountOpen'))
                    .add(SQL.column('amountPending')),
            ),
            new SQLAlias('toPay'),
        ),
        new SQLSelectAs(
            new SQLSum(
                SQL.calculation(SQL.column('amountOpen'))
                    .add(SQL.column('amountPaid'))
                    .add(SQL.column('amountPending')),
            ),
            new SQLAlias('price'),
        ),
    )
        .from(CachedBalance.table)
        .where(SQL.column(CachedBalance.table, 'objectType'), 'registration')
        .groupBy(SQL.column(CachedBalance.table, 'objectId'), SQL.column(CachedBalance.table, 'organizationId')).as('registrationCachedBalance') as SQLNamedExpression, 'registrationCachedBalance',
)
    .where(SQL.column('objectId'), SQL.column(Registration.table, 'id'));
