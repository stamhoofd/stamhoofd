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
    articleId: string;

    @column({ type: 'string' })
    orderId = '';

    static async getUitpasNumbers(webshopId: string, articleId: string): Promise<string[]> {
        const models = await WebshopUitpasNumber.select('uitpasNumber').where('webshopId', webshopId).andWhere('articleId', articleId).fetch();
        return models.map(model => model.uitpasNumber);
    }
}
