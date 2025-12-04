import { column, Database } from '@simonbackx/simple-database';
import { BalanceItemPaymentWithPayment, BalanceItemPaymentWithPrivatePayment, BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItem as BalanceItemStruct, BalanceItemType, BalanceItemWithPayments, BalanceItemWithPrivatePayments, Payment as PaymentStruct, PrivatePayment, VATExcemptReason } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

import { EnumDecoder, MapDecoder } from '@simonbackx/simple-encoding';
import { QueryableModel } from '@stamhoofd/sql';
import { Payment } from './';

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
     * Price per piece
     *
     * NOTE: We store an integer of the price up to 4 digits after the comma.
     * 1 euro = 10000.
     * 0,01 euro = 100
     * 0,0001 euro = 1
     *
     * This is required for correct VAT calculations without intermediate rounding.
     */
    @column({ type: 'integer' })
    unitPrice: number;

    @column({ type: 'integer', nullable: true })
    VATPercentage: number | null = null;

    @column({ type: 'boolean' })
    VATIncluded = true;

    /**
     * Whether there is a VAT excempt reason.
     * Note: keep the original VAT in these cases. On time of payment or invoicing, the VAT excemption will be revalidated.
     * If that fails, we can still charge the VAT.
     */
    @column({ type: 'string', nullable: true })
    VATExcempt: VATExcemptReason | null = null;

    /**
     * This is a cached value for storing in the database.
     * It stores the calculated price with VAT.
     *
     * price should = pricePaid + pricePending + priceOpen
     */
    @column({
        type: 'integer',
        beforeSave: function () {
            return this.priceWithVAT;
        },
    })
    priceTotal = 0;

    /**
     * Cached value, for optimizations
     *
     * NOTE: We store an integer of the price up to 4 digits after the comma.
     * 1 euro = 10000.
     * 0,01 euro = 100
     * 0,0001 euro = 1
     *
     * This is required for correct VAT calculations without intermediate rounding.
     */
    @column({ type: 'integer' })
    pricePaid = 0;

    /**
     * Cached value, for optimizations
     *
     * NOTE: We store an integer of the price up to 4 digits after the comma.
     * 1 euro = 10000.
     * 0,01 euro = 100
     * 0,0001 euro = 1
     *
     * This is required for correct VAT calculations without intermediate rounding.
     */
    @column({ type: 'integer' })
    pricePending = 0;

    /**
     * Cached value, for optimizations
     *
     * NOTE: We store an integer of the price up to 4 digits after the comma.
     * 1 euro = 10000.
     * 0,01 euro = 100
     * 0,0001 euro = 1
     *
     * This is required for correct VAT calculations without intermediate rounding.
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

    /**
     * Marking a balance item as 'paid' can have side effects. To prevent executing these side effects multiple times, we store it in here.
     */
    @column({ type: 'datetime', nullable: true })
    paidAt: Date | null = null;

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

    /**
     * @deprecated: use priceWithVAT
     * NOTE: This contains an integer of the price up to 4 digits after the comma.
     * 1 euro = 10000.
     * 0,01 euro = 100
     * 0,0001 euro = 1
     *
     * This is required for correct VAT calculations without intermediate rounding.
     */
    get price() {
        return this.priceWithVAT;
    }

    /**
     * Difference here is that when the VAT is excempt, this is still set, while VAT will be zero.
     */
    get calculatedVAT() {
        if (!this.VATPercentage) {
            // VAT percentage not set, so treat as 0%
            return 0;
        }

        if (this.VATIncluded) {
            // Calculate VAT on price incl. VAT, which is not 100% correct and causes roudning issues
            return this.unitPrice * this.amount - Math.round(this.unitPrice * this.amount * 100 / (100 + this.VATPercentage));
        }

        // Note: the rounding is only to avoid floating point errors in software, this should not cause any actual rounding
        // That is the reason why we store it up to 4 digits after comma
        return Math.round(this.VATPercentage * this.unitPrice * this.amount / 100);
    }

    /**
     * Note, this is not 100% accurate.
     * Legally we most often need to calculate the VAT on invoice level and round it there.
     * Technically we cannot pass infinite accurate numbers around in a system to avoid rounding. The returned number is
     * therefore rounded up to 4 digits after the comma. On normal amounts, with only 2 digits after the comma, this won't lose accuracy.
     * So the VAT calculation needs to happen at the end again before payment.
     */
    get VAT() {
        if (this.VATExcempt) {
            // Exempt from VAT
            return 0;
        }

        return this.calculatedVAT;
    }

    get priceWithVAT() {
        return this.priceWithoutVAT + this.VAT;
    }

    /**
     * Note: when the VAT is already included, the result of this will be unreliable because of rounding issues.
     * Do not use this in calculations!
     */
    get priceWithoutVAT() {
        if (this.VATIncluded) {
            return this.unitPrice * this.amount - this.calculatedVAT;
        }

        return this.unitPrice * this.amount;
    }

    get isAfterDueDate() {
        if (this.dueAt === null) {
            return true;
        }

        const now = new Date();
        now.setMilliseconds(0);
        return this.dueAt <= now;
    }

    /**
     * Note: cancelled balance items can also return 'true', because if they have pending/paid payments, they are still due with a negative price
     */
    get isDue() {
        if (this.status === BalanceItemStatus.Hidden) {
            return false;
        }

        return this.isAfterDueDate;
    }

    /**
     * NOTE: This contains an integer of the price up to 4 digits after the comma.
     * 1 euro = 10000.
     * 0,01 euro = 100
     * 0,0001 euro = 1
     *
     * This is required for correct VAT calculations without intermediate rounding.
     */
    get calculatedPriceOpen() {
        if (this.status !== BalanceItemStatus.Due) {
            return -this.pricePaid - this.pricePending;
        }
        return this.priceWithVAT - this.pricePaid - this.pricePending;
    }

    /**
     * price minus pricePaid
     */
    get priceUnpaid() {
        return this.priceWithVAT - this.pricePaid;
    }

    get isPaid() {
        if (this.price < 0) {
            return this.priceUnpaid >= 0;
        }
        return this.priceUnpaid <= 0;
    }

    /**
     * Options.cancellationFeePercentage: 0-10000 (0-100%)
     * By default 0% will be charged
     * Will create a new cancellation fee if the cancellation fee percentage is not 0%
     */
    static async deleteItems(items: BalanceItem[], options?: { cancellationFeePercentage?: number }) {
        // Find depending items
        const dependingItemIds = Formatter.uniqueArray(items.filter(i => !!i.dependingBalanceItemId).map(i => i.dependingBalanceItemId!)).filter(id => !items.some(item => item.id === id));

        if (dependingItemIds.length) {
            // Remove depending items too
            const dependingItems = await BalanceItem.getByIDs(...dependingItemIds);
            items = [...items, ...dependingItems];
        }

        const deletedItems: BalanceItem[] = [];

        // Set other items to zero (the balance item payments keep the real price)
        for (const item of items) {
            if (item.status !== BalanceItemStatus.Due) {
                continue;
            }

            deletedItems.push(item);
            item.status = BalanceItemStatus.Canceled;
            await item.save();

            if (options && options.cancellationFeePercentage !== undefined && options.cancellationFeePercentage !== 0) {
                if (options.cancellationFeePercentage < 0 || options.cancellationFeePercentage > 100 * 100) {
                    throw new Error('Invalid cancellation fee percentage. Range 0-10000 expected, received ' + options.cancellationFeePercentage);
                }

                // Refund the user
                const cancellationFee = Math.round(item.price * options.cancellationFeePercentage / 10000);
                if (cancellationFee !== 0) {
                    // Create a new item
                    const cancellationItem = await item.createCancellationItem(cancellationFee);
                    deletedItems.push(cancellationItem);
                }
            }
        }

        // if (deletedItems.length) {
        //    await this.updateOutstanding(deletedItems);
        // }

        return deletedItems;
    }

    async createCancellationItem(fee: number) {
        const item = new BalanceItem();
        item.organizationId = this.organizationId;
        item.memberId = this.memberId;
        item.userId = this.userId;
        item.payingOrganizationId = this.payingOrganizationId;
        item.registrationId = this.registrationId;

        item.type = BalanceItemType.CancellationFee;
        item.relations = this.relations;
        item.description = this.description;
        item.amount = 1;
        item.unitPrice = fee;

        item.status = BalanceItemStatus.Due;
        item.dueAt = null;

        await item.save();

        return item;
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

        // if (needsUpdate) {
        //    await this.updateOutstanding(items);
        // }
    }

    static async undoForDeletedOrders(orderIds: string[]) {
        if (orderIds.length === 0) {
            return;
        }
        const items = await BalanceItem.where({ orderId: { sign: 'IN', value: orderIds } });
        await this.reactivateItems(items);
    }

    static async deleteForDeletedOrders(orderIds: string[], options?: { cancellationFeePercentage?: number }) {
        if (orderIds.length === 0) {
            return;
        }
        const items = await BalanceItem.where({ orderId: { sign: 'IN', value: orderIds } });
        return await this.deleteItems(items, options);
    }

    static async deleteForDeletedMember(memberId: string, options?: { cancellationFeePercentage?: number }) {
        const items = await BalanceItem.where({ memberId });
        return await this.deleteItems(items, options);
    }

    static async deleteForDeletedRegistration(registrationId: string, options?: { cancellationFeePercentage?: number }) {
        const items = await BalanceItem.select()
            .where('registrationId', registrationId)
            .where('type', [BalanceItemType.Registration, BalanceItemType.RegistrationBundleDiscount])
            .fetch();
        return await this.deleteItems(items, options);
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
                WHEN balance_items.status = '${BalanceItemStatus.Due}' THEN (balance_items.priceTotal - balance_items.pricePaid - balance_items.pricePending)
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
