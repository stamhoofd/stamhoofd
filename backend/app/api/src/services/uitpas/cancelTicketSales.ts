import { SimpleError } from '@simonbackx/simple-errors';

async function cancelTicketSale(accessToken: string, useTestEnv: boolean, ticketSaleId: string) {
    // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/delete-a-ticket-sale
    const baseUrl = useTestEnv ? 'https://api-test.uitpas.be' : 'https://api.uitpas.be';
    const url = `${baseUrl}/ticket-sales/${ticketSaleId}`;
    const myHeaders = new Headers();
    myHeaders.append('Authorization', 'Bearer ' + accessToken);
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
            human: $t(`Er is een fout opgetreden bij het verbinden met UiTPAS. Probeer het later opnieuw.`),
        });
    }
    return ticketSaleId;
}

/**
 * Will never throw an error, but will return array of successfully canceled ticket sale ids
 */
export async function cancelTicketSales(accessToken: string, useTestEnv: boolean, ticketSaleIds: string[]) {
    // https://docs.publiq.be/docs/uitpas/uitpas-api/reference/operations/delete-a-ticket-sale
    const promises = ticketSaleIds.map(ticketSaleId => cancelTicketSale(accessToken, useTestEnv, ticketSaleId));
    const results = await Promise.allSettled(promises);
    return results.filter(result => result.status === 'fulfilled').map(result => result.value);
}
