import { column } from '@simonbackx/simple-database';
import { QueryableModel, SQL } from '@stamhoofd/sql';
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

    @column({ type: 'string', nullable: true })
    ticketSaleId: string | null = null;

    @column({ type: 'string', nullable: true })
    uitpasEventUrl: string | null = null;

    @column({ type: 'integer' })
    basePrice: number;

    @column({ type: 'integer' })
    reducedPrice: number;

    @column({ type: 'datetime', nullable: true })
    registeredAt: Date | null = null;

    @column({ type: 'string', nullable: true })
    uitpasTariffId: string | null = null;

    @column({ type: 'string' })
    basePriceLabel: string;

    /**
     * It is possible that the reduced price when registering the ticket sale
     * is different from when the order was placed. Therefore we store the reduced price
     * when the ticket sale was created in this column.
     */
    @column({ type: 'integer', nullable: true })
    reducedPriceUitpas: number | null = null;

    static async areUitpasNumbersUsed(webshopId: string, productId: string, uitpasNumbers: string[], uitpasEventUrl?: string, existingOrderId?: string): Promise<boolean> {
        let query = WebshopUitpasNumber
            .select()
            .where('webshopId', webshopId)
            .andWhere('uitpasNumber', uitpasNumbers);

        if (uitpasEventUrl) {
            query = query.andWhere(SQL.where('productId', productId).or('uitpasEventUrl', uitpasEventUrl));
        }
        else {
            query = query.andWhere('productId', productId);
        }

        if (existingOrderId !== undefined) {
            query = query.andWhereNot('orderId', existingOrderId);
        }

        return !!await query.first(false); ;
    }

    static async areThereRegisteredTicketSales(webshopId: string): Promise<boolean> {
        const query = WebshopUitpasNumber.select().where('webshopId', webshopId).andWhereNot('ticketSaleId', null);
        return !!await query.first(false);
    }
}
