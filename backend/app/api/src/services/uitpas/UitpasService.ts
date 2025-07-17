import { Model } from '@simonbackx/simple-database';
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Order, UitpasClientCredential, WebshopUitpasNumber } from '@stamhoofd/models';
import { OrderStatus, UitpasClientCredentialsStatus, UitpasOrganizersResponse } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { UitpasTokenRepository } from '../../helpers/UitpasTokenRepository';
import { DataValidator, Formatter } from '@stamhoofd/utility';
import { searchUitpasOrganizers } from './searchUitpasOrganizers';
import { checkPermissionsFor } from './checkPermissionsFor';
import { checkUitpasNumbers } from './checkUitpasNumbers';

function shouldReserveUitpasNumbers(status: OrderStatus): boolean {
    return status !== OrderStatus.Canceled && status !== OrderStatus.Deleted;
}

function mapUitpasNumbersToProducts(order: Order): Map<string, string[]> {
    const items = order.data.cart.items;
    const productIdToUitpasNumbers: Map<string, string[]> = new Map();
    for (const item of items) {
        const a = productIdToUitpasNumbers.get(item.product.id);
        if (a) {
            a.push(...item.uitpasNumbers);
        }
        else {
            productIdToUitpasNumbers.set(item.product.id, [...item.uitpasNumbers]); // make a copy
        }
    }
    return productIdToUitpasNumbers;
}

function areUitpasNumbersChanged(oldOrder: Order, newOrder: Order): boolean {
    const oldMap = mapUitpasNumbersToProducts(oldOrder);
    const newMap = mapUitpasNumbersToProducts(newOrder);
    if (oldMap.size !== newMap.size) {
        return true;
    }
    for (const [productId, uitpasNumbers] of oldMap.entries()) {
        const newUitpasNumbers = newMap.get(productId);
        if (!newUitpasNumbers) {
            return true;
        }
        if (newUitpasNumbers.length !== uitpasNumbers.length) {
            return true;
        }
        for (const uitpasNumber of uitpasNumbers) {
            if (!newUitpasNumbers.includes(uitpasNumber)) {
                return true;
            }
        }
    }
    return false;
}

export class UitpasService {
    static listening = false;

    static async updateUitpasNumbers(order: Order) {
        await this.deleteUitpasNumbers(order);
        await this.createUitpasNumbers(order);
    }

    static async createUitpasNumbers(order: Order) {
        const mappedUitpasNumbers = mapUitpasNumbersToProducts(order); // productId -> Set of uitpas numbers
        // add to DB
        const insert = WebshopUitpasNumber.insert();
        insert.columns(
            'id',
            'webshopId',
            'orderId',
            'productId',
            'uitpasNumber',
        );
        const rows = [...mappedUitpasNumbers].flatMap(([productId, uitpasNumbers]) => {
            return uitpasNumbers.map(uitpasNumber => [
                uuidv4(),
                order.webshopId,
                order.id,
                productId,
                uitpasNumber,
            ]);
        });
        if (rows.length === 0) {
            // No uitpas numbers to insert, skipping
            return;
        }
        insert.values(...rows);
        await insert.insert();
    }

    static async deleteUitpasNumbers(order: Order) {
        await WebshopUitpasNumber.delete().where('webshopId', order.webshopId)
            .andWhere('orderId', order.id);
    }

    static listen() {
        if (this.listening) {
            return;
        }
        this.listening = true;
        Model.modelEventBus.addListener(this, async (event) => {
            try {
                if (event.model instanceof Order) {
                    // event.type ==='deteled' -> not needed as foreign key will delete the order
                    if (event.type === 'created' && shouldReserveUitpasNumbers(event.model.status)) {
                        await this.createUitpasNumbers(event.model);
                        return;
                    }
                    if (event.type === 'updated') {
                        if (event.changedFields.status) {
                            const statusBefore = event.originalFields.status as OrderStatus;
                            const statusAfter = event.changedFields.status as OrderStatus;
                            const shouldReserveAfter = shouldReserveUitpasNumbers(statusAfter);
                            if (shouldReserveUitpasNumbers(statusBefore) !== shouldReserveAfter) {
                                if (shouldReserveAfter) {
                                    await this.createUitpasNumbers(event.model);
                                    return;
                                }
                                await this.deleteUitpasNumbers(event.model);
                                return;
                            }
                        }
                        if (event.changedFields.data) {
                            const oldOrder = event.getOldModel() as Order;
                            if (areUitpasNumbersChanged(oldOrder, event.model)) {
                                await this.updateUitpasNumbers(event.model);
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

    static async getSocialTariffForUitpasNumber(uitpasNumber: string, uitpasEventId: string) {
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/list-tariffs
    }

    static async getSocialTariffForEvent(basePrice: number, uitpasEventId: string) {
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/get-a-tariff-static
    }

    static async registerTicketSales() {
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/create-a-ticket-sale
    }

    static async cancelTicketSale() {
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/delete-a-ticket-sale
    }

    static async getTicketSales() {
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/list-ticket-sales
    }

    static async searchUitpasEvents() {
        // input = client credentials of organization & uitpasOrganizerId
        // https://docs.publiq.be/docs/uitpas/events/searching#searching-for-uitpas-events-of-one-specific-organizer
    }

    static async searchUitpasOrganizers(name: string): Promise<UitpasOrganizersResponse> {
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/list-organizers
        const access_token = await UitpasTokenRepository.getAccessTokenFor(); // uses platform credentials
        return searchUitpasOrganizers(access_token, name);
        
    }

    static async checkPermissionsFor(organizationId: string | null, uitpasOrganizerId: string): Promise<{
        status: UitpasClientCredentialsStatus;
        human?: string;
    }> {
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/list-permissions
        const access_token = await UitpasTokenRepository.getAccessTokenFor(organizationId);
        return checkPermissionsFor(access_token, organizationId, uitpasOrganizerId);
    }

    /**
     * Returns the client ID if it is configured for the organization, otherwise an empty string. Empty strings means no client ID and secret configured.
     * @param organisationId 
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
        return checkUitpasNumbers(access_token, uitpasNumbers);
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
};
