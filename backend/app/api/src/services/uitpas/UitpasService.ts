import { Model } from '@simonbackx/simple-database';
import { Order, WebshopUitpasNumber } from '@stamhoofd/models';
import { Cart, OrderStatus, Product, ProductPrice, UitpasClientCredentialsStatus, UitpasOrganizersResponse } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { UitpasTokenRepository } from '../../helpers/UitpasTokenRepository';
import { searchUitpasOrganizers } from './searchUitpasOrganizers';
import { checkPermissionsFor } from './checkPermissionsFor';
import { checkUitpasNumbers } from './checkUitpasNumbers';
import { getSocialTariffForEvent } from './getSocialTariffForEvent';
import { getSocialTariffForUitpasNumbers } from './getSocialTariffForUitpasNumbers';
import { searchUitpasEvents } from './searchUitpasEvents';
import { RegisterTicketSaleRequest, RegisterTicketSaleResponse, registerTicketSales } from './registerTicketSales';
import { cancelTicketSales } from './cancelTicketSales';
import { SimpleError } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';

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

// function mapUitpasNumbersToProducts(order: Order): Map<string, string[]> {
//     const items = order.data.cart.items;
//     const productIdToUitpasNumbers: Map<string, string[]> = new Map();
//     for (const item of items) {
//         const a = productIdToUitpasNumbers.get(item.product.id);
//         if (a) {
//             a.push(...item.uitpasNumbers.map(p => p.uitpasNumber));
//         }
//         else {
//             productIdToUitpasNumbers.set(item.product.id, [...item.uitpasNumbers.map(p => p.uitpasNumber)]); // make a copy
//         }
//     }
//     return productIdToUitpasNumbers;
// }

// function areUitpasNumbersChanged(oldOrder: Order, newOrder: Order): boolean {
//     const oldMap = mapUitpasNumbersToProducts(oldOrder);
//     const newMap = mapUitpasNumbersToProducts(newOrder);
//     if (oldMap.size !== newMap.size) {
//         return true;
//     }
//     for (const [productId, uitpasNumbers] of oldMap.entries()) {
//         const newUitpasNumbers = newMap.get(productId);
//         if (!newUitpasNumbers) {
//             return true;
//         }
//         if (newUitpasNumbers.length !== uitpasNumbers.length) {
//             return true;
//         }
//         for (const uitpasNumber of uitpasNumbers) {
//             if (!newUitpasNumbers.includes(uitpasNumber)) {
//                 return true;
//             }
//         }
//     }
//     return false;
// }

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
                    human: $t(`Er is een fout opgetreden bij het registreren van de UiTPAS ticket verkoop. Probeer het later opnieuw.`),
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

    /**
     * This does not update DB!
     */
    static async updateTicketSales(order: Order, isNewOrder: boolean = false) {
        const ticketSales = getUitpasTicketSales(order);
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
            const { accessToken, useTestEnv } = await UitpasTokenRepository.getAccessTokenFor(order.organizationId);
            canceledUitpasId = await cancelTicketSales(accessToken, toBeCanceledUitpasIds);
            if (canceledUitpasId.length !== toBeCanceledUitpasIds.length) {
                console.error('Failed to cancel some UiTPAS ticket sales, successfully canceled:', canceledUitpasId, 'but tried to cancel:', toBeCanceledUitpasIds);
            }
            try {
                newlyRegistered = await registerTicketSales(accessToken, toBeRegisteredUitpasRequests);
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
                            await this.updateTicketSales(event.model);
                            return;
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
        const { accessToken } = await UitpasTokenRepository.getAccessTokenFor(organizationId);
        return await getSocialTariffForUitpasNumbers(accessToken, uitpasNumbers, basePrice, uitpasEventUrl);
    }

    static async getSocialTariffForEvent(organizationId: string, basePrice: number, uitpasEventUrl: string) {
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/get-a-tariff-static
        const { accessToken } = await UitpasTokenRepository.getAccessTokenFor(organizationId);
        return await getSocialTariffForEvent(accessToken, basePrice, uitpasEventUrl);
    }

    static async cancelTicketSales(organizationId: string, ticketSaleIds: string[]) {
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/delete-a-ticket-sale
        const { accessToken } = await UitpasTokenRepository.getAccessTokenFor(organizationId);
        return await cancelTicketSales(accessToken, ticketSaleIds);
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
        const { clientId, useTestEnv } = await UitpasTokenRepository.getClientIdFor(organizationId);
        return searchUitpasEvents(clientId, useTestEnv, uitpasOrganizerId, textQuery);
    }

    static async searchUitpasOrganizers(name: string): Promise<UitpasOrganizersResponse> {
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/list-organizers
        const { accessToken } = await UitpasTokenRepository.getAccessTokenFor(); // uses platform credentials
        return await searchUitpasOrganizers(accessToken, name);
    }

    static async checkPermissionsFor(organizationId: string | null, uitpasOrganizerId?: string): Promise<{
        status: UitpasClientCredentialsStatus;
        human?: string;
    }> {
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/list-permissions
        const { accessToken } = await UitpasTokenRepository.getAccessTokenFor(organizationId);
        return await checkPermissionsFor(accessToken, organizationId, uitpasOrganizerId);
    }

    /**
     * Returns the client ID if it is configured for the organization, otherwise an empty string. Empty strings means no client ID and secret configured.
     * @param organizationId
     * @returns clientId or empty string if not configured
     */
    static async getClientIdFor(organizationId: string | null): Promise<{
        clientId: string;
        useTestEnv: boolean;
    }> {
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
        const { accessToken, useTestEnv } = await UitpasTokenRepository.getAccessTokenFor(); // use platform credentials
        return await checkUitpasNumbers(accessToken, uitpasNumbers);
    }

    /**
     * Update the uitpas client credentials if they are valid
     * @param organizationId null for platform
     * @param clientId
     * @param useTestEnv
     * @returns wether the credentials were valid and thus stored successfully
     */
    static async updateIfValid(organizationId: string | null, clientId: string, useTestEnv: boolean): Promise<boolean> {
        return await UitpasTokenRepository.updateIfValid(organizationId, clientId, useTestEnv);
    }

    /**
     * Store the uitpas client credentials if they are valid
     * @param organizationId null for platform
     * @param clientId
     * @param clientSecret
     * @returns wether the credentials were valid and thus stored successfully
     */
    static async storeIfValid(organizationId: string | null, clientId: string, clientSecret: string, useTestEnv: boolean): Promise<boolean> {
        return await UitpasTokenRepository.storeIfValid(organizationId, clientId, clientSecret, useTestEnv);
    }

    static async clearClientCredentialsFor(organizationId: string | null) {
        // Clear the uitpas client credentials for the organization
        await UitpasTokenRepository.clearClientCredentialsFor(organizationId);
    }

    static async areThereRegisteredTicketSales(webshopId: string): Promise<boolean> {
        return await WebshopUitpasNumber.areThereRegisteredTicketSales(webshopId);
    }

    static async validateCart(organizationId: string, webshopId: string, cart: Cart, exisitingOrderId?: string): Promise<Cart> {
        let forOrg: {
            accessToken: string;
            useTestEnv: boolean;
        } | null = null;
        let forPlatform: {
            accessToken: string;
            useTestEnv: boolean;
        } | null = null;
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
                    human: $t('Eén of meerdere UiTPAS-nummers zijn al gebruikt voor dit UiTPAS-evenement.'),
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
                        human: $t(`Er is een fout opgetreden bij het registreren van de UiTPAS ticket verkoop. Probeer het later opnieuw.`),
                    });
                }

                forOrg = forOrg ?? await UitpasTokenRepository.getAccessTokenFor(organizationId);
                const verified = await getSocialTariffForUitpasNumbers(forOrg.accessToken, item.uitpasNumbers.map(p => p.uitpasNumber), basePrice, item.product.uitpasEvent.url);
                if (verified.length < item.uitpasNumbers.length) {
                    throw new SimpleError({
                        code: 'uitpas_social_tariff_price_mismatch',
                        message: 'UiTPAS wrong number of prices returned',
                        human: $t('Het kansentarief voor sommige UiTPAS-nummers kon niet worden opgehaald.'),
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
                            human: $t('Het kansentarief voor deze UiTPAS is {correctPrice} in plaats van {orderPrice}.', { correctPrice: Formatter.price(verified[i].price), orderPrice: Formatter.price(item.uitpasNumbers[i].price) }),
                            field: 'uitpasNumbers.' + i.toString(),
                        });
                    }
                }
            }
            else {
                // non-official flow
                forPlatform = forPlatform ?? await UitpasTokenRepository.getAccessTokenFor();
                await checkUitpasNumbers(forPlatform.accessToken, item.uitpasNumbers.map(p => p.uitpasNumber));
            }
        }
        return cart;
    }
};
