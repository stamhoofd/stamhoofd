import { column, ManyToOneRelation } from '@simonbackx/simple-database';
import { v4 as uuidv4 } from 'uuid';

import { BalanceItem, Payment } from './index.js';
import { QueryableModel } from '@stamhoofd/sql';

/**
 * Keeps track of all the created payments of a balance item, which contains the (tries) to pay a balance item.
 * It also keeps track of how much a given payment is split between multiple balance items, which makes it possible to pay a balance item partially.
 */
export class BalanceItemPayment extends QueryableModel {
    static table = 'balance_item_payments';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    organizationId: string;

    @column({ type: 'string', foreignKey: BalanceItemPayment.payment })
    paymentId: string;

    @column({ type: 'string', foreignKey: BalanceItemPayment.balanceItem })
    balanceItemId: string;

    /**
     * Part of price of the payment that is used to 'pay' the balance item
     */
    @column({ type: 'integer' })
    price = 0;

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

    static balanceItem = new ManyToOneRelation(BalanceItem, 'balanceItem');
    static payment = new ManyToOneRelation(Payment, 'payment');
}
