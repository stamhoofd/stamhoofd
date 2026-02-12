import { CachedBalance, Registration } from '@stamhoofd/models';
import { SQL, SQLAlias, SQLCalculation, SQLNamedExpression, SQLPlusSign, SQLSelectAs, SQLSum } from '@stamhoofd/sql';

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

export const registrationCachedBalanceJoin = SQL.leftJoin(
    SQL.select('objectId', 'organizationId',
        new SQLSelectAs(
            new SQLSum(
                new SQLCalculation(
                    SQL.column('amountOpen'),
                    new SQLPlusSign(),
                    SQL.column('amountPending'),
                ),
            ),
            new SQLAlias('toPay'),
        ),
        new SQLSelectAs(
            new SQLSum(
                new SQLCalculation(
                    SQL.column('amountOpen'),
                    new SQLPlusSign(),
                    SQL.column('amountPaid'),
                    new SQLPlusSign(),
                    SQL.column('amountPending'),
                ),
            ),
            new SQLAlias('price'),
        ),
    )
        .from(CachedBalance.table)
        .where(SQL.column(CachedBalance.table, 'objectType'), 'registration')
        .groupBy(SQL.column(CachedBalance.table, 'objectId'), SQL.column(CachedBalance.table, 'organizationId')).as('registrationCachedBalance') as SQLNamedExpression, 'registrationCachedBalance',
)
    .where(SQL.column('objectId'), SQL.column(Registration.table, 'id'));
