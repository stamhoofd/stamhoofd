import { SimpleError } from '@simonbackx/simple-errors';

async function cancelTicketSale(access_token: string, ticketSaleId: string) {
    // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/delete-a-ticket-sale
    const url = 'https://api-test.uitpas.be/ticket-sales/' + ticketSaleId;
    const myHeaders = new Headers();
    myHeaders.append('Authorization', 'Bearer ' + access_token);
    myHeaders.append('Accept', 'application/json');
    const requestOptions = {
        method: 'DELETE',
        headers: myHeaders,
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
        throw new SimpleError({
            code: 'unsuccessful_response_registering_ticket_sales',
            message: `Unsuccessful response when registering UiTPAS ticket sales`,
            human: $t(`ed4e876c-6a40-49a7-ab65-2a4d5f31c13f`),
        });
    }
    return ticketSaleId;
}

/**
 * Will never throw an error, but will return array of successfully canceled ticket sale ids
 */
export async function cancelTicketSales(access_token: string, ticketSaleIds: string[]) {
    // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/delete-a-ticket-sale
    const promises = ticketSaleIds.map(ticketSaleId => cancelTicketSale(access_token, ticketSaleId));
    const results = await Promise.allSettled(promises);
    return results.filter(result => result.status === 'fulfilled').map(result => result.value);
}
