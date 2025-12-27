import { Model } from '@simonbackx/simple-database';
import { SimpleError } from '@simonbackx/simple-errors';
import { Order, WebshopUitpasNumber } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { Cart, OrderStatus, Product, ProductPrice, UitpasClientCredentialsStatus, UitpasOrganizersResponse } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { UitpasTokenRepository } from '../../helpers/UitpasTokenRepository.js';
import { cancelTicketSales } from './cancelTicketSales.js';
import { checkPermissionsFor } from './checkPermissionsFor.js';
import { checkUitpasNumber, checkUitpasNumbers } from './checkUitpasNumbers.js';
import { getSocialTariffForEvent } from './getSocialTariffForEvent.js';
import { getSocialTariffForUitpasNumbers } from './getSocialTariffForUitpasNumbers.js';
import { RegisterTicketSaleRequest, RegisterTicketSaleResponse, registerTicketSales } from './registerTicketSales.js';
import { searchUitpasEvents } from './searchUitpasEvents.js';
import { searchUitpasOrganizers } from './searchUitpasOrganizers.js';

type UitpasTicketSale = {
    basePrice: number;
    uitpasNumber: string;
    basePriceLabel: string;
    reducedPrice: number;
    uitpasEventUrl: string | null;
    uitpasTariffId: string | null;
    productId: string;
};

type InsertUitpasNumber = {
    ticketSaleId: string | null;
    reducedPriceUitpas: number | null;
    registeredAt: Date | null;
    webshopId: string;
    orderId: string;
    productId: string;
    uitpasNumber: string;
    basePrice: number;
    reducedPrice: number;
    basePriceLabel: string;
    uitpasTariffId: string | null; // null for non-official flow
    uitpasEventUrl: string | null; // null for non-official flow
};

export function shouldReserveUitpasNumbers(status: OrderStatus): boolean {
    return status !== OrderStatus.Canceled && status !== OrderStatus.Deleted;
}

function areThereUitpasChanges(oldTicketSales: UitpasTicketSale[], newTicketSales: UitpasTicketSale[]): boolean {
    if (oldTicketSales.length !== newTicketSales.length) {
        return true;
    }
    for (const oldTicketSale of oldTicketSales) {
        const newTicketSale = newTicketSales.find(
            ts =>
                ts.uitpasNumber === oldTicketSale.uitpasNumber
                && ts.basePrice === oldTicketSale.basePrice
                && ts.basePriceLabel === oldTicketSale.basePriceLabel
                && ts.reducedPrice === oldTicketSale.reducedPrice
                && ts.uitpasTariffId === oldTicketSale.uitpasTariffId
                && ts.uitpasEventUrl === oldTicketSale.uitpasEventUrl
                && ts.productId === oldTicketSale.productId,
        );
        if (!newTicketSale) {
            return true;
        }
    }
    return false;
}

function getUitpasTicketSales(order: Order): UitpasTicketSale[] {
    const ticketSales: UitpasTicketSale[] = [];
    if (!shouldReserveUitpasNumbers(order.status)) {
        return ticketSales;
    }
    for (const item of order.data.cart.items) {
        if (item.uitpasNumbers.length > 0) {
            const baseProductPrice = item.product.prices.filter(price => price.id === item.productPrice.uitpasBaseProductPriceId)[0];
            if (!baseProductPrice) {
                throw new SimpleError({
                    code: 'missing_uitpas_base_product_price',
                    message: `Missing UiTPAS base product price`,
                    human: $t(`f7eea411-fb92-458f-bf3e-e36ed870591b`),
                });
            }
            const label = makeBaseProductPriceLabel(item.product, baseProductPrice);
            for (const uitpasNumber of item.uitpasNumbers) {
                ticketSales.push({
                    productId: item.product.id,
                    uitpasNumber: uitpasNumber.uitpasNumber,
                    basePrice: baseProductPrice.price,
                    reducedPrice: uitpasNumber.price,
                    basePriceLabel: label,
                    uitpasEventUrl: item.product.uitpasEvent?.url || null,
                    uitpasTariffId: uitpasNumber.uitpasTariffId || null,
                });
            }
        }
    }
    return ticketSales;
}

function makeBaseProductPriceLabel(product: Product, productPrice: ProductPrice): string {
    if (product.name && productPrice.name) {
        return product.name + ' - ' + productPrice.name;
    }
    if (productPrice.name) {
        return productPrice.name;
    }
    return product.name;
}

export class UitpasService {
    static listening = false;

    static async getWebshopUitpasNumberFromDb(order: Order): Promise<WebshopUitpasNumber[]> {
        return await WebshopUitpasNumber.select().where('webshopId', order.webshopId).andWhere('orderId', order.id).fetch();
    }

    static async createUitpasNumbers(toBeInserted: InsertUitpasNumber[]) {
        if (toBeInserted.length === 0) {
            return;
        }
        // add to DB
        const insert = WebshopUitpasNumber.insert();
        insert.columns(
            'id',
            'ticketSaleId',
            'reducedPriceUitpas',
            'registeredAt',
            'webshopId',
            'orderId',
            'productId',
            'uitpasNumber',
            'basePrice',
            'reducedPrice',
            'basePriceLabel',
            'uitpasTariffId',
            'uitpasEventUrl',
        );
        const rows = toBeInserted.map((insert) => {
            return [
                uuidv4(),
                insert.ticketSaleId,
                insert.reducedPriceUitpas,
                insert.registeredAt,
                insert.webshopId,
                insert.orderId,
                insert.productId,
                insert.uitpasNumber,
                insert.basePrice,
                insert.reducedPrice,
                insert.basePriceLabel,
                insert.uitpasTariffId,
                insert.uitpasEventUrl,
            ];
        });

        insert.values(...rows);
        await insert.insert();
    }

    static async updateTicketSales(order: Order, isNewOrder: boolean, ticketSalesHint?: UitpasTicketSale[]): Promise<void> {
        const ticketSales = ticketSalesHint ?? getUitpasTicketSales(order);

        // queue on order, so no race conditions if the same order is updated multiple times in short time period
        return await QueueHandler.schedule('uitpas-order-' + order.id, async () => {
            const registered = isNewOrder ? [] : await this.getWebshopUitpasNumberFromDb(order);

            const unchangedRegistered: WebshopUitpasNumber[] = [];
            const toBeRegistered: UitpasTicketSale[] = [];

            for (const ticketSale of ticketSales) {
                const i = registered.findIndex(request => request.uitpasNumber === ticketSale.uitpasNumber && request.basePrice === ticketSale.basePrice && request.basePriceLabel === ticketSale.basePriceLabel);
                if (i !== -1) {
                    unchangedRegistered.push(registered[i]);
                    registered.splice(i, 1);
                    continue; // already registered, so skip
                }
                toBeRegistered.push(ticketSale);
            }

            const toBeCanceled = registered;

            // Only register/cancel tickets if official flow is/was used
            const toBeCanceledUitpasIds = toBeCanceled.filter(c => c.uitpasEventUrl && c.uitpasTariffId && c.ticketSaleId).map(c => c.ticketSaleId!);
            const toBeRegisteredUitpasRequests: RegisterTicketSaleRequest[] = toBeRegistered.filter(c => c.uitpasEventUrl && c.uitpasTariffId) as RegisterTicketSaleRequest[];
            const noUitpasTariffId = toBeRegistered.filter(c => c.uitpasEventUrl && !c.uitpasTariffId);
            if (noUitpasTariffId.length > 0) {
                console.warn('Some UiTPAS do not have an uitpasTariffId, although an UiTPAS event is linked (official flow)', noUitpasTariffId);
            }

            let canceledUitpasId: string[] = [];
            let newlyRegistered: Map<RegisterTicketSaleRequest, RegisterTicketSaleResponse> = new Map();
            if (toBeRegisteredUitpasRequests.length !== 0 || toBeCanceledUitpasIds.length !== 0) {
                const access_token = await UitpasTokenRepository.getAccessTokenFor(order.organizationId);
                canceledUitpasId = await cancelTicketSales(access_token, toBeCanceledUitpasIds);
                if (canceledUitpasId.length !== toBeCanceledUitpasIds.length) {
                    console.error('Failed to cancel some UiTPAS ticket sales, successfully canceled:', canceledUitpasId, 'but tried to cancel:', toBeCanceledUitpasIds);
                }
                try {
                    newlyRegistered = await registerTicketSales(access_token, toBeRegisteredUitpasRequests);
                }
                catch (e) {
                    console.error('Failed to register UiTPAS ticket sales', e);
                }
            }

            const effectiveDeletes = toBeCanceled.filter(c => c.ticketSaleId === null || canceledUitpasId.find(id => id === c.ticketSaleId));
            if (effectiveDeletes.length !== 0) {
                await WebshopUitpasNumber.delete().where('id', effectiveDeletes.map(c => c.id));
            }

            const inserts = toBeRegistered.map((c) => {
                const response = newlyRegistered.get(c as RegisterTicketSaleRequest);
                return {
                    ticketSaleId: response?.ticketSaleId ?? null,
                    reducedPriceUitpas: response?.reducedPriceUitpas ?? null,
                    registeredAt: response?.registeredAt ?? null,
                    webshopId: order.webshopId,
                    orderId: order.id,
                    productId: c.productId,
                    uitpasNumber: c.uitpasNumber,
                    basePrice: c.basePrice,
                    reducedPrice: c.reducedPrice,
                    basePriceLabel: c.basePriceLabel,
                    uitpasTariffId: c.uitpasTariffId, // null for non-official flow
                    uitpasEventUrl: c.uitpasEventUrl, // null for non-official flow
                };
            });
            await this.createUitpasNumbers(inserts);
        });
    }

    static listen() {
        if (this.listening) {
            return;
        }
        this.listening = true;
        Model.modelEventBus.addListener(this, async (event) => {
            try {
                if (event.model instanceof Order) {
                    // if (event.type === 'deleted') {
                    // delete from db is not not needed as foreign key will delete the order
                    // we do not cancel the ticket sales
                    if (event.type === 'created' && shouldReserveUitpasNumbers(event.model.status)) {
                        await this.updateTicketSales(event.model, true);
                        return;
                    }
                    if (event.type === 'updated') {
                        if (event.changedFields.status) {
                            const statusBefore = event.originalFields.status as OrderStatus;
                            const statusAfter = event.changedFields.status as OrderStatus;
                            const shouldReserveAfter = shouldReserveUitpasNumbers(statusAfter);
                            if (shouldReserveUitpasNumbers(statusBefore) !== shouldReserveAfter) {
                                await this.updateTicketSales(event.model, shouldReserveAfter);
                                return;
                            }
                        }
                        if (event.changedFields.data) {
                            const oldTicketSales = getUitpasTicketSales(event.getOldModel() as Order);
                            const newTicketSales = getUitpasTicketSales(event.model);
                            if (areThereUitpasChanges(oldTicketSales, newTicketSales)) {
                                await this.updateTicketSales(event.model, false, newTicketSales);
                                return;
                            }
                        }
                    }
                }
            }
            catch (e) {
                console.error('Failed to update UiTPAS-numbers after order update', e);
            }
        });
    }

    static async getSocialTariffForUitpasNumbers(organizationId: string, uitpasNumbers: string[], basePrice: number, uitpasEventUrl: string) {
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/list-tariffs
        const access_token = await UitpasTokenRepository.getAccessTokenFor(organizationId);
        return await getSocialTariffForUitpasNumbers(access_token, uitpasNumbers, basePrice, uitpasEventUrl);
    }

    static async getSocialTariffForEvent(organizationId: string, basePrice: number, uitpasEventUrl: string) {
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/get-a-tariff-static
        const access_token = await UitpasTokenRepository.getAccessTokenFor(organizationId);
        return await getSocialTariffForEvent(access_token, basePrice, uitpasEventUrl);
    }

    static async cancelTicketSales(organisationId: string, ticketSaleIds: string[]) {
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/delete-a-ticket-sale
        const access_token = await UitpasTokenRepository.getAccessTokenFor(organisationId);
        return await cancelTicketSales(access_token, ticketSaleIds);
    }

    static async getTicketSales() {
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/list-ticket-sales
    }

    static async registerAttendance() {
        // https://api-test.uitpas.be/checkins
    }

    static async searchUitpasEvents(organizationId: string, uitpasOrganizerId: string, textQuery?: string) {
        // input = client id of organization (never platform0 & uitpasOrganizerId
        // https://docs.publiq.be/docs/uitpas/events/searching#searching-for-uitpas-events-of-one-specific-organizer
        const clientId = await UitpasTokenRepository.getClientIdFor(organizationId);
        return searchUitpasEvents(clientId, uitpasOrganizerId, textQuery);
    }

    static async searchUitpasOrganizers(name: string): Promise<UitpasOrganizersResponse> {
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/list-organizers
        const access_token = await UitpasTokenRepository.getAccessTokenFor(); // uses platform credentials
        return await searchUitpasOrganizers(access_token, name);
    }

    static async checkPermissionsFor(organizationId: string | null, uitpasOrganizerId: string): Promise<{
        status: UitpasClientCredentialsStatus;
        human?: string;
    }> {
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/list-permissions
        const access_token = await UitpasTokenRepository.getAccessTokenFor(organizationId);
        return await checkPermissionsFor(access_token, organizationId, uitpasOrganizerId);
    }

    /**
     * Returns the client ID if it is configured for the organization, otherwise an empty string. Empty strings means no client ID and secret configured.
     * @param organizationId
     * @returns clientId or empty string if not configured
     */
    static async getClientIdFor(organizationId: string | null): Promise<string> {
        // Get the uitpas client credentials for the organization
        return await UitpasTokenRepository.getClientIdFor(organizationId);
    }

    /**
     * Checks multiple uitpas numbers
     * If any of the uitpas numbers is invalid, it will throw a SimpleErrors instance with all errors.
     * The field of the error will be the index of the uitpas number in the array.
     * @param uitpasNumbers The uitpas numbers to check
     */
    static async checkUitpasNumbers(uitpasNumbers: string[]) {
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/get-a-pass
        const access_token = await UitpasTokenRepository.getAccessTokenFor(); // use platform credentials
        return await checkUitpasNumbers(access_token, uitpasNumbers);
    }

    /**
     * Checks uitpas number
     * If any of the uitpas number is invalid, it will throw a SimpleErrors instance.
     * @param uitpasNumber The uitpas number to check
     */
    static async checkUitpasNumber(uitpasNumber: string) {
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/get-a-pass
        const access_token = await UitpasTokenRepository.getAccessTokenFor(); // use platform credentials
        return await checkUitpasNumber(access_token, uitpasNumber);
    }

    /**
     * Store the uitpas client credentials if they are valid
     * @param organizationId null for platform
     * @param clientId
     * @param clientSecret
     * @returns wether the credentials were valid and thus stored successfully
     */
    static async storeIfValid(organizationId: string | null, clientId: string, clientSecret: string): Promise<boolean> {
        return await UitpasTokenRepository.storeIfValid(organizationId, clientId, clientSecret);
    }

    static async clearClientCredentialsFor(organizationId: string | null) {
        // Clear the uitpas client credentials for the organization
        await UitpasTokenRepository.clearClientCredentialsFor(organizationId);
    }

    static async areThereRegisteredTicketSales(webshopId: string): Promise<boolean> {
        return await WebshopUitpasNumber.areThereRegisteredTicketSales(webshopId);
    }

    static async validateCart(organizationId: string, webshopId: string, cart: Cart, exisitingOrderId?: string): Promise<Cart> {
        let access_token_org: string | null = null;
        let access_token_platform: string | null = null;
        for (const item of cart.items) {
            if (item.uitpasNumbers.length === 0) {
                continue;
            }

            // verify the UiTPAS numbers are not already used for this product
            const hasBeenUsed = await WebshopUitpasNumber.areUitpasNumbersUsed(webshopId, item.product.id, item.uitpasNumbers.map(p => p.uitpasNumber), item.product.uitpasEvent?.url, exisitingOrderId);
            if (hasBeenUsed) {
                throw new SimpleError({
                    code: 'uitpas_number_already_used',
                    message: 'One or more uitpas numbers are already used',
                    human: $t('f3daff19-a227-4e45-b19a-c770bd7a6687'),
                    field: 'uitpasNumbers',
                });
            }

            if (item.product.uitpasEvent) {
                // official flow
                const basePrice = item.product.prices.filter(price => price.id === item.productPrice.uitpasBaseProductPriceId)[0]?.price;
                if (!basePrice) {
                    throw new SimpleError({
                        code: 'missing_uitpas_base_product_price',
                        message: `Missing UiTPAS base product price`,
                        human: $t(`3d08a166-11a7-4429-8ff7-84458bbe3e9a`),
                    });
                }

                access_token_org = access_token_org ?? await UitpasTokenRepository.getAccessTokenFor(organizationId);
                const verified = await getSocialTariffForUitpasNumbers(access_token_org, item.uitpasNumbers.map(p => p.uitpasNumber), basePrice, item.product.uitpasEvent.url);
                if (verified.length < item.uitpasNumbers.length) {
                    throw new SimpleError({
                        code: 'uitpas_social_tariff_price_mismatch',
                        message: 'UiTPAS wrong number of prices returned',
                        human: $t('83c472b8-4bc5-4282-bbc9-1c6a2d382171'),
                        field: 'uitpasNumbers',
                    });
                }
                for (let i = 0; i < verified.length; i++) {
                    if (item.uitpasNumbers[i].uitpasTariffId !== verified[i].uitpasTariffId) {
                        // silently update
                        item.uitpasNumbers[i].uitpasTariffId = verified[i].uitpasTariffId;
                    }
                    if (item.uitpasNumbers[i].price !== verified[i].price) {
                        throw new SimpleError({
                            code: 'uitpas_social_tariff_price_mismatch',
                            message: 'UiTPAS social tariff have a different price',
                            human: $t('9a0ad099-99e3-4341-beac-f14feb3fb9d1', { correctPrice: Formatter.price(verified[i].price), orderPrice: Formatter.price(item.uitpasNumbers[i].price) }),
                            field: 'uitpasNumbers.' + i.toString(),
                        });
                    }
                }
            }
            else {
                // non-official flow
                access_token_platform = access_token_platform ?? await UitpasTokenRepository.getAccessTokenFor();
                await checkUitpasNumbers(access_token_platform, item.uitpasNumbers.map(p => p.uitpasNumber));
            }
        }
        return cart;
    }
};
