import { CachedBalance, Registration } from '@stamhoofd/models';
import { SQL, SQLAlias, SQLNamedExpression, SQLSelectAs, SQLSum } from '@stamhoofd/sql';

export const cachedBalanceGroupedJoin = SQL.leftJoin(
    SQL.select('objectId', 'organizationId',
        new SQLSelectAs(
            new SQLSum(
                SQL.column('amountOpen'),
            ),
            new SQLAlias('amountOpen'),
        ))
        .from(CachedBalance.table)
        .groupBy(SQL.column(CachedBalance.table, 'objectId'), SQL.column(CachedBalance.table, 'organizationId')).as('cb') as SQLNamedExpression, 'cb',
)
    .where(SQL.column('objectId'), SQL.column(Registration.table, 'memberId'))
    .andWhere(SQL.column('organizationId'), SQL.column(Registration.table, 'organizationId'));
