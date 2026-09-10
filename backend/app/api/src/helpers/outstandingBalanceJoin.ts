import { CachedBalance, Member, Registration } from '@stamhoofd/models';
import type { SQLNamedExpression } from '@stamhoofd/sql';
import { SQL, SQLAlias, SQLSelectAs, SQLSum } from '@stamhoofd/sql';

const joinCache = new Map<string, any>();

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

export const memberCachedBalanceRawJoin = (organizationId: string) => {
    const cacheId = `member_cached_balance_org_${organizationId}`;

    if (joinCache.has(cacheId)) {
        return joinCache.get(cacheId);
    };

    const query = SQL.leftJoin(
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
        .where(SQL.column('objectId'), SQL.column(Member.table, 'id'))
        .andWhere(SQL.column('organizationId'), organizationId);

    joinCache.set(cacheId, query);

    return query;
};
export const memberCachedBalanceForMemberOrganizationJoin = (organizationId: string) => {
    const query = memberCachedBalanceRawJoin(organizationId);

    return query;
};

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
