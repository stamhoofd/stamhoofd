import { column, Model, SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { SQL, SQLAlias, SQLCalculation, SQLMin, SQLMinusSign, SQLMultiplicationSign, SQLSelect, SQLSelectAs, SQLSum, SQLWhere, SQLWhereSign } from '@stamhoofd/sql';
import { BalanceItemStatus, ReceivableBalanceType } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { BalanceItem } from './BalanceItem';

/**
 * Keeps track of how much a member/user owes or needs to be reimbursed.
 */
export class CachedBalance extends Model {
    static table = 'cached_outstanding_balances';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    organizationId: string;

    @column({ type: 'string' })
    objectId: string;

    /**
     * Defines which field to select
     * organization: payingOrganizationId
     * member: member id
     * user: all balance items with that user id, but without a member id
     */
    @column({ type: 'string' })
    objectType: ReceivableBalanceType;

    @column({ type: 'integer' })
    amount = 0;

    @column({ type: 'integer' })
    amountPending = 0;

    /**
     * This is the minimum `dueAt` that lies in the future of all **unpaid** balance items connected to this object.
     */
    @column({ type: 'datetime', nullable: true })
    recalculateAt: Date | null = null;

    @column({
        type: 'datetime', beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    static async getForObjects(objectIds: string[], limitOrganizationId?: string | null): Promise<CachedBalance[]> {
        const query = this.select()
            .where('objectId', objectIds);

        if (limitOrganizationId) {
            query.where('organizationId', limitOrganizationId);
        }

        return await query.fetch();
    }

    static async updateForObjects(organizationId: string, objectIds: string[], objectType: ReceivableBalanceType) {
        switch (objectType) {
            case ReceivableBalanceType.organization:
                await this.updateForOrganizations(organizationId, objectIds);
                break;
            case ReceivableBalanceType.member:
                await this.updateForMembers(organizationId, objectIds);
                break;
            case ReceivableBalanceType.user:
                await this.updateForUsers(organizationId, objectIds);
                break;
        }
    }

    static async balanceForObjects(organizationId: string, objectIds: string[], objectType: ReceivableBalanceType) {
        switch (objectType) {
            case ReceivableBalanceType.organization:
                return await this.balanceForOrganizations(organizationId, objectIds);
            case ReceivableBalanceType.member:
                return await this.balanceForMembers(organizationId, objectIds);
            case ReceivableBalanceType.user:
                return await this.balanceForUsers(organizationId, objectIds);
        }
    }

    private static async fetchBalanceItems(organizationId: string, objectIds: string[], columnName: string, customWhere?: SQLWhere) {
        const query = BalanceItem.select()
            .where('organizationId', organizationId)
            .where(columnName, objectIds)
            .whereNot('status', BalanceItemStatus.Hidden)
            .where(SQL.where('dueAt', null).or('dueAt', SQLWhereSign.LessEqual, new Date()))
            .where(
                SQL.where(
                    new SQLCalculation(
                        new SQLCalculation(
                            SQL.column('unitPrice'),
                            new SQLMultiplicationSign(),
                            SQL.column('amount'),
                        ),
                        new SQLMinusSign(),
                        SQL.column('pricePaid'),
                    )
                    , SQLWhereSign.NotEqual, 0)
                    .or('pricePending', SQLWhereSign.NotEqual, 0),
            );

        if (customWhere) {
            query.where(customWhere);
        }

        return await query.fetch();
    }

    private static async fetchForObjects(organizationId: string, objectIds: string[], columnName: string, customWhere?: SQLWhere) {
        const now = new Date();
        const query = SQL.select(
            SQL.column(columnName),
            new SQLSelectAs(
                new SQLCalculation(
                    new SQLSum(
                        new SQLCalculation(
                            SQL.column('unitPrice'),
                            new SQLMultiplicationSign(),
                            SQL.column('amount'),
                        ),
                    ),
                    new SQLMinusSign(),
                    new SQLSum(
                        SQL.column('pricePaid'),
                    ),
                ),
                new SQLAlias('data__amount'),
            ),
            new SQLSelectAs(
                new SQLSum(
                    SQL.column('pricePending'),
                ),
                new SQLAlias('data__amountPending'),
            ),
        )
            .from(BalanceItem.table)
            .where('organizationId', organizationId)
            .where(columnName, objectIds)
            .whereNot('status', BalanceItemStatus.Hidden)
            .where(SQL.where('dueAt', null).or('dueAt', SQLWhereSign.LessEqual, now))
            .groupBy(SQL.column(columnName));

        if (customWhere) {
            query.where(customWhere);
        }

        const result = await query.fetch();

        // Czlculate future due
        const dueQuery = SQL.select(
            SQL.column(columnName),
            new SQLSelectAs(
                new SQLMin(
                    SQL.column('dueAt'),
                ),
                new SQLAlias('data_dueAt'),
            ),
        )
            .from(BalanceItem.table)
            .where('organizationId', organizationId)
            .where(columnName, objectIds)
            .whereNot('status', BalanceItemStatus.Hidden)
            .whereNot('dueAt', null)
            .where('dueAt', SQLWhereSign.Greater, now)
            .groupBy(SQL.column(columnName));

        const dueResult = await dueQuery.fetch();

        const results: [string, { amount: number; amountPending: number; recalculateAt: Date | null }][] = [];
        for (const row of result) {
            if (!row['data']) {
                throw new Error('Invalid data namespace');
            }

            if (!row[BalanceItem.table]) {
                throw new Error('Invalid ' + BalanceItem.table + ' namespace');
            }

            const objectId = row[BalanceItem.table][columnName];
            const amount = row['data']['amount'];
            const amountPending = row['data']['amountPending'];

            if (typeof objectId !== 'string') {
                throw new Error('Invalid objectId');
            }

            if (typeof amount !== 'number') {
                throw new Error('Invalid amount');
            }

            if (typeof amountPending !== 'number') {
                throw new Error('Invalid amountPending');
            }

            results.push([objectId, { amount, amountPending, recalculateAt: null }]);
        }

        for (const row of dueResult) {
            if (!row['data']) {
                throw new Error('Invalid data namespace');
            }

            if (!row[BalanceItem.table]) {
                throw new Error('Invalid ' + BalanceItem.table + ' namespace');
            }

            const objectId = row[BalanceItem.table][columnName];
            const dueAt = row['data']['dueAt'];

            if (typeof objectId !== 'string') {
                throw new Error('Invalid objectId');
            }

            if (!(dueAt instanceof Date)) {
                throw new Error('Invalid dueAt');
            }

            const result = results.find(r => r[0] === objectId);
            if (result) {
                result[1].recalculateAt = dueAt;
            }
            else {
                results.push([objectId, { amount: 0, amountPending: 0, recalculateAt: dueAt }]);
            }
        }

        // Add missing object ids (with 0 amount, otherwise we don't reset the amounts back to zero when all the balance items are hidden)
        for (const objectId of objectIds) {
            if (!results.find(([id]) => id === objectId)) {
                results.push([objectId, { amount: 0, amountPending: 0, recalculateAt: null }]);
            }
        }

        return results;
    }

    private static async setForResults(organizationId: string, result: [string, { amount: number; amountPending: number; recalculateAt: null | Date }][], objectType: ReceivableBalanceType) {
        if (result.length === 0) {
            return;
        }
        const query = SQL.insert(this.table)
            .columns(
                'id',
                'organizationId',
                'objectId',
                'objectType',
                'amount',
                'amountPending',
                'recalculateAt',
                'createdAt',
                'updatedAt',
            )
            .values(...result.map(([objectId, { amount, amountPending, recalculateAt }]) => {
                return [
                    uuidv4(),
                    organizationId,
                    objectId,
                    objectType,
                    amount,
                    amountPending,
                    recalculateAt,
                    new Date(),
                    new Date(),
                ];
            }))
            .as('v')
            .onDuplicateKeyUpdate(
                SQL.assignment('amount', SQL.column('v', 'amount')),
                SQL.assignment('amountPending', SQL.column('v', 'amountPending')),
                SQL.assignment('recalculateAt', SQL.column('v', 'recalculateAt')),
                SQL.assignment('updatedAt', SQL.column('v', 'updatedAt')),
            );

        await query.insert();
    }

    static async updateForOrganizations(organizationId: string, organizationIds: string[]) {
        if (organizationIds.length === 0) {
            return;
        }
        const results = await this.fetchForObjects(organizationId, organizationIds, 'payingOrganizationId');
        await this.setForResults(organizationId, results, ReceivableBalanceType.organization);
    }

    static async updateForMembers(organizationId: string, memberIds: string[]) {
        if (memberIds.length === 0) {
            return;
        }
        const results = await this.fetchForObjects(organizationId, memberIds, 'memberId');
        await this.setForResults(organizationId, results, ReceivableBalanceType.member);
    }

    static async updateForUsers(organizationId: string, userIds: string[]) {
        if (userIds.length === 0) {
            return;
        }
        const results = await this.fetchForObjects(organizationId, userIds, 'userId', SQL.where('memberId', null));
        await this.setForResults(organizationId, results, ReceivableBalanceType.user);
    }

    static async balanceForOrganizations(organizationId: string, organizationIds: string[]) {
        if (organizationIds.length === 0) {
            return [];
        }
        return await this.fetchBalanceItems(organizationId, organizationIds, 'payingOrganizationId');
    }

    static async balanceForMembers(organizationId: string, memberIds: string[]) {
        if (memberIds.length === 0) {
            return [];
        }
        return await this.fetchBalanceItems(organizationId, memberIds, 'memberId');
    }

    static async balanceForUsers(organizationId: string, userIds: string[]) {
        if (userIds.length === 0) {
            return [];
        }
        return await this.fetchBalanceItems(organizationId, userIds, 'userId', SQL.where('memberId', null));
    }

    /**
     * Experimental: needs to move to library
     */
    static select() {
        const transformer = (row: SQLResultNamespacedRow): CachedBalance => {
            const d = (this as typeof CachedBalance & typeof Model).fromRow(row[this.table] as any) as CachedBalance | undefined;

            if (!d) {
                throw new Error('EmailTemplate not found');
            }

            return d;
        };

        const select = new SQLSelect(transformer, SQL.wildcard());
        return select.from(SQL.table(this.table));
    }
}
