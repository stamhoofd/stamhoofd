import { column, Database } from '@simonbackx/simple-database';
import { BalanceItemPaymentWithPayment, BalanceItemPaymentWithPrivatePayment, BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItem as BalanceItemStruct, BalanceItemType, BalanceItemWithPayments, BalanceItemWithPrivatePayments, Payment as PaymentStruct, PrivatePayment } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

import { EnumDecoder, MapDecoder } from '@simonbackx/simple-encoding';
import { QueryableModel, SQL } from '@stamhoofd/sql';
import { Document, MemberUser, Payment } from './';
import { CachedBalance } from './CachedBalance';

/**
 * Keeps track of how much a member/user owes or needs to be reimbursed.
 */
export class BalanceItem extends QueryableModel {
    static table = 'balance_items';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    // Receiving organization

    @column({ type: 'string' })
    organizationId: string;

    // Payer: memberId, userId or payingOrganizationId

    @column({ type: 'string', nullable: true })
    memberId: string | null = null;

    @column({ type: 'string', nullable: true })
    userId: string | null = null;

    @column({ type: 'string', nullable: true })
    payingOrganizationId: string | null = null;

    /**
     * The registration ID that is linked to this balance item
     */
    @column({ type: 'string', nullable: true })
    registrationId: string | null = null;

    /**
     * The order ID that is linked to this balance item
     */
    @column({ type: 'string', nullable: true })
    orderId: string | null = null;

    /**
     * The depending balance item ID that is linked to this balance item
     * -> as soon as this balance item is paid, we'll mark this balance item as pending if it is still hidden
     * -> allows for a pay back system where one user needs to pay back a different user
     */
    @column({ type: 'string', nullable: true })
    dependingBalanceItemId: string | null = null;

    @column({ type: 'string' })
    type = BalanceItemType.Other;

    @column({ decoder: new MapDecoder(new EnumDecoder(BalanceItemRelationType), BalanceItemRelation), type: 'json' })
    relations: Map<BalanceItemRelationType, BalanceItemRelation> = new Map();

    @column({ type: 'string' })
    description = '';

    /**
     * Total prices
     */
    @column({ type: 'integer' })
    amount = 1;

    /**
     * Total prices
     */
    @column({ type: 'integer' })
    unitPrice: number;

    /**
     * Cached value, for optimizations
     */
    @column({ type: 'integer' })
    pricePaid = 0;

    /**
     * Cached value, for optimizations
     */
    @column({ type: 'integer' })
    pricePending = 0;

    /**
     * Cached value, for optimizations
     */
    @column({
        type: 'integer',
        beforeSave: function () {
            return this.calculatedPriceOpen;
        },
        skipUpdate: true,
    })
    priceOpen = 0;

    /**
     * todo: deprecate ('pending' and 'paid') + 'hidden' status and replace with 'due' + 'hidden'
     * -> maybe add 'due' (due if dueAt is null or <= now), 'hidden' (never due), 'future' (= not due until dueAt - but not possible to pay earlier)
     */
    @column({ type: 'string' })
    status = BalanceItemStatus.Due;

    /**
     * In case the balance item doesn't have to be paid immediately, we can set a due date.
     * When the due date is reached, it is set to null and the cached balance is updated.
     */
    @column({ type: 'datetime', nullable: true })
    dueAt: Date | null = null;

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

    get price() {
        return this.unitPrice * this.amount;
    }

    get calculatedPriceOpen() {
        if (this.status !== BalanceItemStatus.Due) {
            return -this.pricePaid - this.pricePending;
        }
        return this.price - this.pricePaid - this.pricePending;
    }

    /**
     * price minus pricePaid
     */
    get priceUnpaid() {
        return this.price - this.pricePaid;
    }

    get isPaid() {
        if (this.price < 0) {
            return this.priceUnpaid >= 0;
        }
        return this.priceUnpaid <= 0;
    }

    static async deleteItems(items: BalanceItem[]) {
        // Find depending items
        const dependingItemIds = Formatter.uniqueArray(items.filter(i => !!i.dependingBalanceItemId).map(i => i.dependingBalanceItemId!)).filter(id => !items.some(item => item.id === id));

        if (dependingItemIds.length) {
            // Remove depending items too
            const dependingItems = await BalanceItem.getByIDs(...dependingItemIds);
            items = [...items, ...dependingItems];
        }

        // todo: in the future we could automatically delete payments that are not needed anymore and weren't paid yet -> to prevent leaving ghost payments
        // for now, an admin can manually cancel those payments
        let needsUpdate = false;

        // Set other items to zero (the balance item payments keep the real price)
        for (const item of items) {
            if (item.status !== BalanceItemStatus.Due) {
                continue;
            }

            needsUpdate = true;
            item.status = BalanceItemStatus.Canceled;
            await item.save();
        }

        if (needsUpdate) {
            await this.updateOutstanding(items);
        }
    }

    static async reactivateItems(items: BalanceItem[]) {
        let needsUpdate = false;
        for (const item of items) {
            if (item.status === BalanceItemStatus.Hidden) {
                item.status = BalanceItemStatus.Due;
                needsUpdate = true;
                await item.save();
            }
        }

        if (needsUpdate) {
            await this.updateOutstanding(items);
        }
    }

    static async undoForDeletedOrders(orderIds: string[]) {
        if (orderIds.length === 0) {
            return;
        }
        const items = await BalanceItem.where({ orderId: { sign: 'IN', value: orderIds } });
        await this.reactivateItems(items);
    }

    static async deleteForDeletedOrders(orderIds: string[]) {
        if (orderIds.length === 0) {
            return;
        }
        const items = await BalanceItem.where({ orderId: { sign: 'IN', value: orderIds } });
        await this.deleteItems(items);
    }

    static async deleteForDeletedMember(memberId: string) {
        const items = await BalanceItem.where({ memberId });
        await this.deleteItems(items);
    }

    static async deleteForDeletedRegistration(registrationId: string) {
        const items = await BalanceItem.where({ registrationId });
        await this.deleteItems(items);
    }

    static async getForRegistration(registrationId: string, organizationId?: string) {
        let q = BalanceItem.select()
            .where('registrationId', registrationId)
            .whereNot('status', BalanceItemStatus.Hidden);

        if (organizationId) {
            q = q.where('organizationId', organizationId);
        }

        const items = await q
            .fetch();

        return {
            items,
            ...(await this.loadPayments(items)),
        };
    }

    /**
     * Update how many every object in the system owes or needs to be reimbursed
     * and also updates the pricePaid/pricePending cached values in Balance items and members
     */
    static async updateOutstanding(items: BalanceItem[]) {
        console.log('Update outstanding balance for', items.length, 'items');

        await BalanceItem.updatePricePaid(items.map(i => i.id));

        const organizationIds = Formatter.uniqueArray(items.map(p => p.organizationId));
        for (const organizationId of organizationIds) {
            const filteredItems = items.filter(i => i.organizationId === organizationId);

            const memberIds = Formatter.uniqueArray(filteredItems.map(p => p.memberId).filter(id => id !== null));
            await CachedBalance.updateForMembers(organizationId, memberIds);

            let userIds = filteredItems.filter(p => p.userId !== null).map(p => p.userId!);

            if (memberIds.length) {
                // Now also include the userIds of the members
                const userMemberIds = (await MemberUser.select().where('membersId', memberIds).fetch()).map(m => m.usersId);
                userIds.push(...userMemberIds);
            }
            userIds = Formatter.uniqueArray(userIds);

            await CachedBalance.updateForUsers(organizationId, userIds);

            const organizationIds = Formatter.uniqueArray(filteredItems.map(p => p.payingOrganizationId).filter(id => id !== null));
            await CachedBalance.updateForOrganizations(organizationId, organizationIds);

            const registrationIds: string[] = Formatter.uniqueArray(filteredItems.map(p => p.registrationId).filter(id => id !== null));
            await CachedBalance.updateForRegistrations(organizationId, registrationIds);

            if (registrationIds.length) {
                await Document.updateForRegistrations(registrationIds, organizationId);
            }
        }
    }

    /**
     * Update the outstanding balance of multiple members in one go (or all members)
     */
    static async updatePricePaid(balanceItemIds: string[] | 'all') {
        if (balanceItemIds !== 'all' && balanceItemIds.length === 0) {
            return;
        }

        const params: any[] = [];
        let firstWhere = '';
        let secondWhere = '';

        if (balanceItemIds !== 'all') {
            firstWhere = ` AND balanceItemId IN (?)`;
            params.push(balanceItemIds);
            params.push(balanceItemIds);

            secondWhere = `WHERE balance_items.id IN (?)`;
            params.push(balanceItemIds);
        }

        // Note: this query only works in MySQL because of the SET assignment behaviour allowing to reference newly set values
        const query = `
        UPDATE
            balance_items
        LEFT JOIN (
            SELECT
                balanceItemId,
                sum(balance_item_payments.price) AS price
            FROM
                balance_item_payments
                LEFT JOIN payments ON payments.id = balance_item_payments.paymentId
            WHERE
                payments.status = 'Succeeded'${firstWhere}
            GROUP BY
                balanceItemId
            ) paid ON paid.balanceItemId = balance_items.id
        LEFT JOIN (
            SELECT
                balanceItemId,
                sum(balance_item_payments.price) AS price
            FROM
                balance_item_payments
                LEFT JOIN payments ON payments.id = balance_item_payments.paymentId
            WHERE
                payments.status != 'Succeeded' AND payments.status != 'Failed'${firstWhere}
            GROUP BY
                balanceItemId
            ) pending ON pending.balanceItemId = balance_items.id 
        SET balance_items.pricePaid = coalesce(paid.price, 0),
            balance_items.pricePending = coalesce(pending.price, 0),
            balance_items.priceOpen = (CASE
                WHEN balance_items.status = '${BalanceItemStatus.Due}' THEN (balance_items.unitPrice * balance_items.amount - balance_items.pricePaid - balance_items.pricePending)
                ELSE (-balance_items.pricePaid - balance_items.pricePending)
            END)
        ${secondWhere}`;

        await Database.update(query, params);
    }

    static async loadPayments(items: BalanceItem[]) {
        if (items.length == 0) {
            return { balanceItemPayments: [], payments: [] };
        }

        // Load balance payment items
        const { BalanceItemPayment } = await import('./BalanceItemPayment');
        const balanceItemPayments = await BalanceItemPayment.select()
            .where('balanceItemId', items.map(i => i.id))
            .fetch();

        const payments = await Payment.getByIDs(...balanceItemPayments.map(p => p.paymentId));

        return { payments, balanceItemPayments };
    }

    getStructure() {
        return BalanceItemStruct.create({
            ...this,
        });
    }

    static async getStructureWithPayments(items: BalanceItem[]): Promise<BalanceItemWithPayments[]> {
        if (items.length === 0) {
            return [];
        }

        const { payments, balanceItemPayments } = await BalanceItem.loadPayments(items);

        return items.map((item) => {
            const thisBalanceItemPayments = balanceItemPayments.filter(p => p.balanceItemId === item.id);

            return BalanceItemWithPayments.create({
                ...item,
                payments: thisBalanceItemPayments.map((p) => {
                    const payment = payments.find(pp => pp.id === p.paymentId)!;
                    return BalanceItemPaymentWithPayment.create({
                        ...p,
                        payment: PaymentStruct.create(payment),
                    });
                }),
            });
        });
    }

    static async getStructureWithPrivatePayments(items: BalanceItem[]): Promise<BalanceItemWithPrivatePayments[]> {
        if (items.length === 0) {
            return [];
        }

        const { payments, balanceItemPayments } = await BalanceItem.loadPayments(items);

        return items.map((item) => {
            const thisBalanceItemPayments = balanceItemPayments.filter(p => p.balanceItemId === item.id);

            return BalanceItemWithPrivatePayments.create({
                ...item,
                payments: thisBalanceItemPayments.map((p) => {
                    const payment = payments.find(pp => pp.id === p.paymentId)!;
                    return BalanceItemPaymentWithPrivatePayment.create({
                        ...p,
                        payment: PrivatePayment.create(payment),
                    });
                }),
            });
        });
    }

    static async balanceItemsForUsersAndMembers(organizationId: string | null, userIds: string[], memberIds: string[]): Promise<BalanceItem[]> {
        if (memberIds.length == 0 && userIds.length == 0) {
            return [];
        }

        const params: any[] = [];
        const where: string[] = [];

        if (memberIds.length) {
            if (memberIds.length == 1) {
                where.push(`memberId = ?`);
                params.push(memberIds[0]);
            }
            else {
                where.push(`memberId IN (?)`);
                params.push(memberIds);
            }
        }

        // Note here, we don't search for memberId IS NULL restriction in MySQL because it slows down the query too much (500ms)
        // Better if we do it in code here
        if (userIds.length) {
            if (userIds.length == 1) {
                where.push('userId = ?');
                params.push(userIds[0]);
            }
            else {
                where.push('userId IN (?)');
                params.push(userIds);
            }
        }

        const requiredWhere: string[] = [];

        if (organizationId) {
            requiredWhere.push('organizationId = ?');
            params.push(organizationId);
        }

        const query = `SELECT ${BalanceItem.getDefaultSelect()} FROM ${BalanceItem.table} WHERE (${where.join(' OR ')}) ${requiredWhere.length ? (' AND ' + requiredWhere.join(' AND ')) : ''} AND ${BalanceItem.table}.status != ?`;
        params.push(BalanceItemStatus.Hidden);

        const [rows] = await Database.select(query, params);
        const balanceItems = BalanceItem.fromRows(rows, BalanceItem.table);

        // Filter out items of other members
        if (memberIds.length) {
            return balanceItems.filter(b => !b.memberId || memberIds.includes(b.memberId));
        }
        return balanceItems;
    }

    static async balanceItemsForOrganization(organizationId: string): Promise<BalanceItem[]> {
        return await BalanceItem.select()
            .where('payingOrganizationId', organizationId)
            .whereNot('status', BalanceItemStatus.Hidden)
            .fetch();
    }
}
