import { SimpleError } from '@simonbackx/simple-errors';

export type RegisterTicketSaleRequest = {
    basePrice: number;
    uitpasEventUrl: string;
    basePriceLabel: string;
    uitpasNumber: string;
    uitpasTariffId: string;
};

export type RegisterTicketSaleResponse = {
    ticketSaleId: string;
    reducedPriceUitpas: number;
    registeredAt: Date;
};

type SuccessResponse = {
    id: string;
    tariff: {
        price: number;
        id: string;
    };
    uitpasNumber: string;
    eventId: string;
};

function assertisSuccessResponse(json: unknown): asserts json is SuccessResponse {
    if (
        typeof json !== 'object'
        || json === null
        || !('tariff' in json)
        || typeof json.tariff !== 'object'
        || json.tariff === null
        || !('price' in json.tariff)
        || typeof json.tariff.price !== 'number'
        || !('id' in json.tariff)
        || typeof json.tariff.id !== 'string'
        || !('id' in json)
        || typeof json.id !== 'string'
        || !('uitpasNumber' in json)
        || typeof json.uitpasNumber !== 'string'
        || !('eventId' in json)
        || typeof json.eventId !== 'string'
    ) {
        console.error('Invalid register ticket sale response', json);
        throw new SimpleError({
            code: 'invalid_register_ticket_sale_response',
            message: `Invalid register ticket sale response`,
            human: $t(`f5cac12d-ced6-43e6-bbd9-81b381807154`),
        });
    }
}

/**
 * @returns Map of request (from parameters) -> response
 */

export async function registerTicketSales(access_token: string, registerTicketSaleRequests: RegisterTicketSaleRequest[]): Promise<Map<RegisterTicketSaleRequest, RegisterTicketSaleResponse>> {
    // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/create-a-ticket-sale

    console.error('Registering ticket sales', registerTicketSaleRequests);
    if (registerTicketSaleRequests.length === 0) {
        return new Map();
    };
    const url = 'https://api-test.uitpas.be/ticket-sales';
    const body = registerTicketSaleRequests.map((ticketSale) => {
        const eventId = ticketSale.uitpasEventUrl.split('/').pop();
        if (!eventId) {
            throw new SimpleError({
                code: 'invalid_uitpas_event_url',
                message: `Invalid UiTPAS event URL: ${ticketSale.uitpasEventUrl}`,
                human: $t(`85fb6e02-9b69-43cc-acf7-96a576461560`),
            });
        }

        return {
            uitpasNumber: ticketSale.uitpasNumber,
            eventId,
            regularPrice: (ticketSale.basePrice / 10000).toFixed(2), // Convert from 4 decimals to 0 decimals
            regularPriceLabel: ticketSale.basePriceLabel,
            tariff: {
                id: ticketSale.uitpasTariffId,
            },
        };
    });
    const myHeaders = new Headers();
    myHeaders.append('Authorization', 'Bearer ' + access_token);
    myHeaders.append('Accept', 'application/json');
    myHeaders.append('Content-Type', 'application/json');
    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: JSON.stringify(body),
    };
    const response = await fetch(url, requestOptions).catch(() => {
        // Handle network errors
        throw new SimpleError({
            code: 'uitpas_unreachable_registering_ticket_sales',
            message: `Network issue when registering UiTPAS ticket sales`,
            human: $t(
                `We konden UiTPAS niet bereiken om de ticket verkoop te registreren bij UiTPAS. Probeer het later opnieuw.`,
            ),
        });
    });
    if (!response.ok) {
        const json: unknown = await response.json().catch(() => { /* ignore */ });
        console.error('Unsuccessful response when registering ticket sales', json);
        throw new SimpleError({
            code: 'unsuccessful_response_registering_ticket_sales',
            message: `Unsuccessful response when registering UiTPAS ticket sales`,
            human: $t(`ed4e876c-6a40-49a7-ab65-2a4d5f31c13f`),
        });
    }
    const json = await response.json().catch(() => {});
    if (!json || !Array.isArray(json)) {
        console.error('Invalid response when registering ticket sales', json);
        throw new SimpleError({
            code: 'invalid_response_registering_ticket_sales',
            message: `Invalid response when registering ticket sales`,
            human: $t(`f5cac12d-ced6-43e6-bbd9-81b381807154`),
        });
    }
    const now = new Date();
    const results: Map<RegisterTicketSaleRequest, RegisterTicketSaleResponse> = new Map();
    for (const ticketSale of json) {
        assertisSuccessResponse(ticketSale);
        const request = registerTicketSaleRequests.find(r => r.uitpasNumber === ticketSale.uitpasNumber && r.uitpasEventUrl.endsWith(`/${ticketSale.eventId}`) && r.uitpasTariffId === ticketSale.tariff.id);
        if (!request) {
            console.error('Could not find request for ticket sale', ticketSale);
            continue;
        }
        results.set(request, {
            ticketSaleId: ticketSale.id,
            reducedPriceUitpas: Math.round(ticketSale.tariff.price * 100) * 100,
            registeredAt: now,
        });
    }
    return results;
}
