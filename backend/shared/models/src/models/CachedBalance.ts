import { column } from '@simonbackx/simple-database';
import { QueryableModel, SQL, SQLAlias, SQLMin, SQLSelectAs, SQLSum, SQLWhere, SQLWhereSign } from '@stamhoofd/sql';
import { BalanceItemStatus, BalanceItem as BalanceItemStruct, ReceivableBalanceType } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { BalanceItem } from './BalanceItem.js';
import { MemberUser } from './MemberUser.js';
import { Formatter } from '@stamhoofd/utility';

/**
 * Keeps track of how much a member/user owes or needs to be reimbursed.
 */
export class CachedBalance extends QueryableModel {
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
    amountPaid = 0;

    @column({ type: 'integer' })
    amountOpen = 0;

    /**
     * The sum of unconfirmed payments
     */
    @column({ type: 'integer' })
    amountPending = 0;

    /**
     * This is the minimum `dueAt` that lies in the future of all **unpaid** balance items connected to this object.
     */
    @column({ type: 'datetime', nullable: true })
    nextDueAt: Date | null = null;

    @column({ type: 'datetime', nullable: true })
    lastReminderEmail: Date | null = null;

    @column({ type: 'integer' })
    lastReminderAmountOpen = 0;

    @column({ type: 'integer' })
    reminderEmailCount = 0;

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

    static async getForObjects(objectIds: string[], limitOrganizationId?: string | null, objectType?: ReceivableBalanceType): Promise<CachedBalance[]> {
        if (objectIds.length === 0) {
            return [];
        }

        const query = this.select()
            .where('objectId', objectIds);

        if (limitOrganizationId) {
            query.where('organizationId', limitOrganizationId);
        }

        if (objectType !== undefined) {
            query.where('objectType', objectType);
        }

        return await query.fetch();
    }

    static async updateForObjects(organizationId: string, objectIds: string[], objectType: ReceivableBalanceType) {
        if (objectIds.length === 0) {
            return;
        }

        switch (objectType) {
            case ReceivableBalanceType.organization:
                await this.updateForOrganizations(organizationId, objectIds);
                break;
            case ReceivableBalanceType.member:
                await this.updateForMembers(organizationId, objectIds);
                break;
            case ReceivableBalanceType.user:
            case ReceivableBalanceType.userWithoutMembers:
                await this.updateForUsers(organizationId, objectIds);
                break;
            case ReceivableBalanceType.registration:
                await this.updateForRegistrations(organizationId, objectIds);
                break;
        }
    }

    static async balanceForObjects(organizationId: string, objectIds: string[], objectType: ReceivableBalanceType) {
        if (objectIds.length === 0) {
            return [];
        }

        switch (objectType) {
            case ReceivableBalanceType.organization:
                return await this.balanceForOrganizations(organizationId, objectIds);
            case ReceivableBalanceType.member:
                return await this.balanceForMembers(organizationId, objectIds);
            case ReceivableBalanceType.user:
                return await this.balanceForUsers(organizationId, objectIds, true);
            case ReceivableBalanceType.userWithoutMembers:
                return await this.balanceForUsers(organizationId, objectIds, false);
            case ReceivableBalanceType.registration:
                return await this.balanceForRegistrations(organizationId, objectIds);
        }
    }

    private static async fetchBalanceItems(organizationId: string, objectIds: string[], columnName: string, customWhere?: SQLWhere) {
        const query = BalanceItem.select()
            .where('organizationId', organizationId)
            .where(columnName, objectIds)
            .whereNot('status', BalanceItemStatus.Hidden)
            .where(
                SQL.where(SQL.column('priceOpen'), SQLWhereSign.NotEqual, 0)
                    .or('pricePending', SQLWhereSign.NotEqual, 0),
            );

        if (customWhere) {
            query.where(customWhere);
        }

        return await query.fetch();
    }

    static whereNeedsUpdate() {
        return SQL.where('nextDueAt', SQLWhereSign.LessEqual, BalanceItemStruct.getDueOffset());
    }

    private static async fetchForObjects(organizationId: string, objectIds: string[], columnName: string, customWhere?: SQLWhere) {
        const dueOffset = BalanceItemStruct.getDueOffset();
        const query = SQL.select(
            SQL.column(columnName),
            new SQLSelectAs(
                new SQLSum(
                    SQL.column('pricePaid'),
                ),
                new SQLAlias('data__amountPaid'),
            ),
            new SQLSelectAs(
                new SQLSum(
                    SQL.column('priceOpen'),
                ),
                new SQLAlias('data__amountOpen'),
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
            .where(SQL.where('dueAt', null).or('dueAt', SQLWhereSign.LessEqual, dueOffset))
            .groupBy(SQL.column(columnName));

        if (customWhere) {
            query.where(customWhere);
        }

        const result = await query.fetch();

        // Calculate future due
        const dueQuery = SQL.select(
            SQL.column(columnName),
            new SQLSelectAs(
                new SQLMin(
                    SQL.column('dueAt'),
                ),
                new SQLAlias('data__dueAt'),
            ),
            // If the current amount_due is negative, we can ignore that negative part if there is a future due item
            new SQLSelectAs(
                new SQLSum(
                    SQL.column('pricePaid'),
                ),
                new SQLAlias('data__amountPaid'),
            ),
            new SQLSelectAs(
                new SQLSum(
                    SQL.column('priceOpen'),
                ),
                new SQLAlias('data__amountOpen'),
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
            .where('status', BalanceItemStatus.Due)
            .whereNot('dueAt', null)
            .where('dueAt', SQLWhereSign.Greater, dueOffset)
            .groupBy(SQL.column(columnName));

        if (customWhere) {
            dueQuery.where(customWhere);
        }

        const dueResult = await dueQuery.fetch();

        const results: [string, { amountPaid: number; amountOpen: number; amountPending: number; nextDueAt: Date | null }][] = [];
        for (const row of result) {
            if (!row['data']) {
                throw new Error('Invalid data namespace');
            }

            if (!row[BalanceItem.table]) {
                throw new Error('Invalid ' + BalanceItem.table + ' namespace');
            }

            const objectId = row[BalanceItem.table][columnName];
            const amountOpen = row['data']['amountOpen'];
            const amountPending = row['data']['amountPending'];
            const amountPaid = row['data']['amountPaid'];

            if (typeof objectId !== 'string') {
                throw new Error('Invalid objectId');
            }

            if (typeof amountOpen !== 'number') {
                throw new Error('Invalid amountOpen');
            }

            if (typeof amountPending !== 'number') {
                throw new Error('Invalid amountPending');
            }

            if (typeof amountPaid !== 'number') {
                throw new Error('Invalid amountPaid');
            }

            results.push([objectId, { amountPaid, amountOpen, amountPending, nextDueAt: null }]);
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
            const amountOpen = row['data']['amountOpen'];
            const amountPending = row['data']['amountPending'];
            const amountPaid = row['data']['amountPaid'];

            if (typeof objectId !== 'string') {
                throw new Error('Invalid objectId');
            }

            if (!(dueAt instanceof Date)) {
                throw new Error('Invalid dueAt');
            }

            if (typeof amountOpen !== 'number') {
                throw new Error('Invalid amountOpen');
            }

            if (typeof amountPending !== 'number') {
                throw new Error('Invalid amountPending');
            }

            if (typeof amountPaid !== 'number') {
                throw new Error('Invalid amountPaid');
            }

            const result = results.find(r => r[0] === objectId);
            if (result) {
                if (amountOpen !== 0) {
                    result[1].nextDueAt = dueAt;
                }

                if (result[1].amountOpen < 0) {
                    if (amountOpen > 0) {
                        // Let the future due amount fill in the gap until maximum 0
                        result[1].amountOpen = Math.min(0, result[1].amountOpen + amountOpen);
                    }
                }

                result[1].amountPending += amountPending;
                result[1].amountPaid += amountPaid;
            }
            else {
                results.push([objectId, { amountPaid, amountOpen: 0, amountPending, nextDueAt: amountOpen !== 0 ? dueAt : null }]);
            }
        }

        // Add missing object ids (with 0 amount, otherwise we don't reset the amounts back to zero when all the balance items are hidden)
        for (const objectId of objectIds) {
            if (!results.find(([id]) => id === objectId)) {
                results.push([objectId, { amountPaid: 0, amountOpen: 0, amountPending: 0, nextDueAt: null }]);
            }
        }

        return results;
    }

    private static async setForResults(organizationId: string, result: [string, { amountPaid: number; amountOpen: number; amountPending: number; nextDueAt: null | Date }][], objectType: ReceivableBalanceType) {
        if (result.length === 0) {
            return;
        }
        const query = this.insert()
            .columns(
                'id',
                'organizationId',
                'objectId',
                'objectType',
                'amountPaid',
                'amountOpen',
                'amountPending',
                'nextDueAt',
                'createdAt',
                'updatedAt',
                'reminderEmailCount',
            )
            .values(...result.map(([objectId, { amountPaid, amountOpen, amountPending, nextDueAt }]) => {
                return [
                    uuidv4(),
                    organizationId,
                    objectId,
                    objectType,
                    amountPaid,
                    amountOpen,
                    amountPending,
                    nextDueAt,
                    new Date(),
                    new Date(),
                    0,
                ];
            }))
            .as('v')
            .onDuplicateKeyUpdate(
                SQL.assignment('amountPaid', SQL.column('v', 'amountPaid')),
                SQL.assignment('amountOpen', SQL.column('v', 'amountOpen')),
                SQL.assignment('amountPending', SQL.column('v', 'amountPending')),
                SQL.assignment('nextDueAt', SQL.column('v', 'nextDueAt')),
                SQL.assignment('updatedAt', SQL.column('v', 'updatedAt')),

                // Reset email count if amountOpen is zero
                SQL.assignment(
                    'reminderEmailCount',
                    SQL.if(SQL.column('v', 'amountOpen'), 0)
                        .then(0)
                        .else(SQL.column('reminderEmailCount')),
                ),

                // Reset lastReminderEmail if amountOpen is zero
                SQL.assignment(
                    'lastReminderEmail',
                    SQL.if(SQL.column('v', 'amountOpen'), 0)
                        .then(null)
                        .else(SQL.column('lastReminderEmail')),
                ),
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

    static async updateForRegistrations(organizationId: string, registrationIds: string[]) {
        if (registrationIds.length === 0) {
            return;
        }
        const results = await this.fetchForObjects(organizationId, registrationIds, 'registrationId');
        await this.setForResults(organizationId, results, ReceivableBalanceType.registration);
    }

    static async updateForUsers(organizationId: string, userIds: string[]) {
        if (userIds.length === 0) {
            return;
        }
        const results = await this.fetchForObjects(
            organizationId,
            userIds,
            'userId',
            SQL.where('memberId', null),
        );

        // Fetch cached balance of these members and merge the results
        await this.setForResults(organizationId, results, ReceivableBalanceType.userWithoutMembers);

        // Fetch members of these users
        const memberUsers = await MemberUser.select().where('usersId', userIds).fetch();
        const memberIds = memberUsers.map(mu => mu.membersId);
        const memberCachedBalances = await this.getForObjects(memberIds, organizationId);

        for (const memberCachedBalance of memberCachedBalances) {
            const userIds = Formatter.uniqueArray(memberUsers.filter(mu => mu.membersId === memberCachedBalance.objectId).map(mu => mu.usersId));

            for (const userId of userIds) {
                // if already in results: append
                const result = results.find(([objectId]) => objectId === userId);

                if (result) {
                    result[1].amountPaid += memberCachedBalance.amountPaid;
                    result[1].amountOpen += memberCachedBalance.amountOpen;
                    result[1].amountPending += memberCachedBalance.amountPending;
                    if (memberCachedBalance.nextDueAt && (!result[1].nextDueAt || memberCachedBalance.nextDueAt > result[1].nextDueAt)) {
                        result[1].nextDueAt = memberCachedBalance.nextDueAt;
                    }
                }
                else {
                    // Not possible
                    throw new Error('User not found in results');
                }
            }
        }

        // Fetch cached balance of these members and merge the results
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

    static async balanceForUsers(organizationId: string, userIds: string[], includeUserMembers = false) {
        if (userIds.length === 0) {
            return [];
        }
        const base = await this.fetchBalanceItems(organizationId, userIds, 'userId', SQL.where('memberId', null));

        if (!includeUserMembers) {
            return base;
        }

        const memberUsers = await MemberUser.select().where('usersId', userIds).fetch();
        const memberIds = Formatter.uniqueArray(memberUsers.map(mu => mu.membersId));
        const memberCachedBalances = await this.balanceForMembers(organizationId, memberIds);
        return base.concat(memberCachedBalances);
    }

    static async balanceForRegistrations(organizationId: string, registrationIds: string[]) {
        if (registrationIds.length === 0) {
            return [];
        }
        return await this.fetchBalanceItems(organizationId, registrationIds, 'registrationId');
    }
}
