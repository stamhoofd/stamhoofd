import { Model } from '@simonbackx/simple-database';
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Order, WebshopUitpasNumber } from '@stamhoofd/models';
import { OrderStatus, UitpasOrganizerResponse, UitpasOrganizersResponse } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { UitpasTokenRepository } from '../helpers/UitpasTokenRepository';
import { DataValidator } from '@stamhoofd/utility';
import { ObjectData } from '@simonbackx/simple-encoding';


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

type UitpasNumberSuccessfulResponse = {
    socialTariff: {
        status: 'ACTIVE' | 'EXPIRED' | 'NONE';
    };
    messages?: Array<{
        text: string;
    }>;
};

type UitpasNumberErrorResponse = {
    title: string; // e.g., "Invalid uitpas number"
    endUserMessage?: {
        nl: string;
    };
};

function assertIsUitpasNumberSuccessfulResponse(
    json: unknown,
): asserts json is UitpasNumberSuccessfulResponse {
    if (
        typeof json !== 'object'
        || json === null
        || !('socialTariff' in json)
        || typeof json.socialTariff !== 'object'
        || json.socialTariff === null
        || !('status' in json.socialTariff)
        || typeof json.socialTariff.status !== 'string'
        || (json.socialTariff.status !== 'ACTIVE' && json.socialTariff.status !== 'EXPIRED' && json.socialTariff.status !== 'NONE')
        || ('messages' in json && (!Array.isArray(json.messages) || !json.messages.every(
            (message: unknown) => typeof message === 'object' && message !== null && 'text' in message && typeof message.text === 'string')))
    ) {
        console.error('Invalid response when retrieving pass by UiTPAS number:', json);
        throw new SimpleError({
            code: 'invalid_response_retrieving_pass_by_uitpas_number',
            message: `Invalid response when retrieving pass by UiTPAS  number`,
            human: $t(`13731c1d-a519-442f-bc06-2e610fa2889d`),
        });
    }
}

function isUitpasNumberErrorResponse(
    json: unknown,
): json is UitpasNumberErrorResponse {
    return typeof json === 'object'
        && json !== null
        && 'title' in json
        && typeof json.title === 'string'
        && (!('endUserMessage' in json)
            || (typeof json.endUserMessage === 'object' && json.endUserMessage !== null && 'nl' in json.endUserMessage && typeof json.endUserMessage.nl === 'string')
        );
}

type OrganizersResponse = {
    totalItems: number;
    member: Array<{
        id: string;
        name: string;
    }>;
}

function assertIsOrganizersResponse(json: unknown): asserts json is OrganizersResponse {
    if (
        typeof json !== 'object'
        || json === null
        || !('totalItems' in json)
        || typeof json.totalItems !== 'number'
        || !('member' in json)
        || !Array.isArray(json.member)
        || !json.member.every(
            (member: unknown) => typeof member === 'object' && member !== null && 'id' in member && typeof member.id === 'string' && 'name' in member && typeof member.name === 'string',
        )
    ) {
        console.error('Invalid response when searching for UiTPAS organizers:', json);
        throw new SimpleError({
            code: 'invalid_response_searching_uitpas_organizers',
            message: `Invalid response when searching for UiTPAS organizers`,
            human: $t(`Er is een fout opgetreden bij het zoeken naar UiTPAS-organisaties. Probeer het later opnieuw.`),
        });
    }
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
        // uses platform credentials
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/list-organizers
        if (name === '') {
            throw new SimpleError({
                code: 'empty_uitpas_organizer_name',
                message: `Empty name when searching for UiTPAS organizers`,
                human: $t(`Je moet een naam opgeven om UiTPAS-organisaties te zoeken.`),
            });
        }
        const access_token = await UitpasTokenRepository.getAccessTokenFor(); // uses platform credentials
        const baseUrl = 'https://api-test.uitpas.be/organizers';
        const params = new URLSearchParams()
        params.append('name', name);
        const url = `${baseUrl}?${params.toString()}`;
        const myHeaders = new Headers();
        myHeaders.append('Authorization', 'Bearer ' + access_token);
        myHeaders.append('Accept', 'application/json');
        const requestOptions = {
            method: 'GET',
            headers: myHeaders,
        };
        const response = await fetch(url, requestOptions).catch(() => {
            // Handle network errors
            throw new SimpleError({
                code: 'uitpas_unreachable_searching_organizers',
                message: `Network issue when searching for UiTPAS organizers`,
                human: $t(
                    `We konden UiTPAS niet bereiken om UiTPAS-organisaties op te zoeken. Probeer het later opnieuw.`,
                ),
            });
        });
        if (!response.ok) {
            throw new SimpleError({
                code: 'unsuccessful_response_searching_uitpas_organizers',
                message: `Unsuccessful response when searching for UiTPAS organizers`,
                human: $t(`Er is een fout opgetreden bij het verbinden met UiTPAS. Probeer het later opnieuw.`),
            });
        }
        const json = await response.json().catch(() => {
            // Handle JSON parsing errors
            throw new SimpleError({
                code: 'invalid_json_searching_uitpas_organizers',
                message: `Invalid json when searching for UiTPAS organizers`,
                human: $t(
                    `Er is een fout opgetreden bij het communiceren met UiTPAS. Probeer het later opnieuw.`,
                ),
            });
        });
        
        assertIsOrganizersResponse(json);
        const organizersResponse = new UitpasOrganizersResponse();
        organizersResponse.totalItems = json.totalItems;
        organizersResponse.member = json.member.map((member) => {
            const organizer = new UitpasOrganizerResponse();
            organizer.id = member.id;
            organizer.name = member.name;
            return organizer;
        });
        return organizersResponse;
    }

    /**
     * Checks if the access token has sufficient permissions (for either organization or platform calls). If not it will throw an error.
     * @param organizationId null for platform
     * @param uitpasOrganizerId the id of the uitpas organizer to check permissions for
     */
    static async checkPermissions(organizationId: string | null, uitpasOrganizerId: string) {
        // verify the permissions of the client credentials of the organization
        // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/list-permissions
    }

    static async checkUitpasNumber(uitpasNumber: string) {
        // static check (using regex)
        if (!DataValidator.isUitpasNumberValid(uitpasNumber)) {
            throw new SimpleError({
                code: 'invalid_uitpas_number',
                message: `Invalid UiTPAS number: ${uitpasNumber}`,
                human: $t(
                    `Het opgegeven UiTPAS-nummer is ongeldig. Controleer het nummer en probeer het opnieuw.`,
                ),
            });
        }
        const access_token = await UitpasTokenRepository.getAccessTokenFor(); // for nothing, means for platform
        const baseUrl = 'https://api-test.uitpas.be'; // TO DO: Use the URL from environment variables

        const url = `${baseUrl}/passes/${uitpasNumber}`;
        const myHeaders = new Headers();
        myHeaders.append('Authorization', 'Bearer ' + access_token);
        const requestOptions = {
            method: 'GET',
            headers: myHeaders,
        };

        const response = await fetch(url, requestOptions).catch(() => {
            // Handle network errors
            throw new SimpleError({
                code: 'uitpas_unreachable_retrieving_pass_by_uitpas_number',
                message: `Network issue when retrieving pass by UiTPAS number`,
                human: $t(
                    `We konden UiTPAS niet bereiken om jouw UiTPAS-nummer te valideren. Probeer het later opnieuw.`,
                ),
            });
        });
        if (!response.ok) {
            const json: unknown = await response.json().catch(() => { /* ignore */ });
            let endUserMessage = '';

            if (json) {
                console.error(`UiTPAS API returned an error for UiTPAS number ${uitpasNumber}:`, json);
            }
            else {
                console.error(`UiTPAS API returned an error for UiTPAS number ${uitpasNumber}:`, response.statusText);
            }

            if (isUitpasNumberErrorResponse(json)) {
                endUserMessage = json.endUserMessage ? json.endUserMessage.nl : '';
            }

            if (endUserMessage) {
                throw new SimpleError({
                    code: 'unsuccessful_but_expected_response_retrieving_pass_by_uitpas_number',
                    message: `Unsuccesful response with message when retrieving pass by UiTPAS number, message: ${endUserMessage}`,
                    human: endUserMessage,
                });
            }

            throw new SimpleError({
                code: 'unsuccessful_and_unexpected_response_retrieving_pass_by_uitpas_number',
                message: `Unsuccesful response without message when retrieving pass by UiTPAS number`,
                human: $t(`13731c1d-a519-442f-bc06-2e610fa2889d`),
            });
        }

        const json = await response.json().catch(() => {
            // Handle JSON parsing errors
            throw new SimpleError({
                code: 'invalid_json_retrieving_pass_by_uitpas_number',
                message: `Invalid json when retrieving pass by UiTPAS  number`,
                human: $t(
                    `Er is een fout opgetreden bij het communiceren met UiTPAS. Probeer het later opnieuw.`,
                ),
            });
        });
        assertIsUitpasNumberSuccessfulResponse(json);
        if (json.messages) {
            const humanMessage = json.messages[0].text; // only display the first message

            // alternatively, join all messages
            // const text = json.messages.map((message: any) => message.text).join(', ');

            throw new SimpleError({
                code: 'uitpas_number_issue',
                message: `UiTPAS API returned an error: ${humanMessage}`,
                human: humanMessage,
            });
        }
        if (json.socialTariff.status !== 'ACTIVE') {
            // THIS SHOULD NOT HAPPEN, as in that case json.messages should be present
            throw new SimpleError({
                code: 'non_active_social_tariff',
                message: `UiTPAS social tariff is not ACTIVE but ${json.socialTariff.status}`,
                human: $t(
                    `Het opgegeven UiTPAS-nummer heeft geen actief kansentarief. Neem contact op met de UiTPAS-organisatie voor meer informatie.`,
                ),
            });
        }
        // no errors -> the uitpas number is valid and social tariff is applicable
    }

    /**
     * Checks multiple uitpas numbers
     * If any of the uitpas numbers is invalid, it will throw a SimpleErrors instance with all errors.
     * The field of the error will be the index of the uitpas number in the array.
     * @param uitpasNumbers The uitpas numbers to check
     */
    static async checkUitpasNumbers(uitpasNumbers: string[]) {
        const simpleErrors = new SimpleErrors();
        for (let i = 0; i < uitpasNumbers.length; i++) {
            const uitpasNumber = uitpasNumbers[i];
            try {
                await this.checkUitpasNumber(uitpasNumber); // Throws if invalid
            }
            catch (e) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    e.addNamespace(i.toString());
                    simpleErrors.addError(e);
                }
                else {
                    throw e;
                }
            }
        }
        if (simpleErrors.errors.length > 0) {
            throw simpleErrors;
        }
    }
};
