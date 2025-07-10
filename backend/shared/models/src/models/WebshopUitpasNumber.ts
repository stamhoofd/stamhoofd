import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { v4 as uuidv4 } from 'uuid';

export class WebshopUitpasNumber extends QueryableModel {
    static table = 'webshop_uitpas_numbers';

    // Columns
    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    uitpasNumber: string;

    @column({ type: 'string' })
    webshopId: string;

    @column({ type: 'string' })
    productId: string;

    @column({ type: 'string' })
    orderId = '';

    static async areUitpasNumbersUsed(webshopId: string, productId: string, uitpasNumbers: string[]): Promise<boolean> {
        const hasBeenUsed = !!(await WebshopUitpasNumber.select().where('webshopId', webshopId).andWhere('productId', productId).andWhere('uitpasNumber', uitpasNumbers).first(false));
        return hasBeenUsed;
    }
}
