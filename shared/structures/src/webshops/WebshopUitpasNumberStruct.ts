import { AutoEncoder, DateDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';

/**
 * One UiTPAS number used for one product in one order.
 */
export class WebshopUitpasNumberStruct extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = '';

    @field({ decoder: StringDecoder })
    uitpasNumber = '';

    @field({ decoder: StringDecoder })
    webshopId = '';

    @field({ decoder: StringDecoder })
    productId = '';

    /**
     * Resolved by the backend: products are stored inside the webshop, so clients
     * that don't have the webshop loaded can't look this up themselves.
     */
    @field({ decoder: StringDecoder })
    productName = '';

    @field({ decoder: StringDecoder })
    orderId = '';

    /**
     * Null as long as the order hasn't been marked as valid.
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    orderNumber: number | null = null;

    @field({ decoder: DateDecoder })
    orderCreatedAt: Date = new Date();

    /**
     * Name of the customer that placed the order.
     */
    @field({ decoder: StringDecoder })
    orderName = '';

    /**
     * Set when the product is linked to an UiTPAS event and the ticket sale was registered
     * via the UiTPAS API.
     */
    @field({ decoder: StringDecoder, nullable: true })
    ticketSaleId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    uitpasEventUrl: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    uitpasTariffId: string | null = null;

    @field({ decoder: IntegerDecoder })
    basePrice = 0;

    @field({ decoder: StringDecoder })
    basePriceLabel = '';

    @field({ decoder: IntegerDecoder })
    reducedPrice = 0;

    /**
     * The reduced price at the time the ticket sale was registered, which can differ from
     * the reduced price when the order was placed.
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    reducedPriceUitpas: number | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    registeredAt: Date | null = null;

    get isRegistered(): boolean {
        return this.registeredAt !== null;
    }
}
