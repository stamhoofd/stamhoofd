import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { v4 as uuidv4 } from 'uuid';

export class BuckarooPayment extends QueryableModel {
    static table = 'buckaroo_payments';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    paymentId: string;

    @column({ type: 'string' })
    transactionKey: string;
}
