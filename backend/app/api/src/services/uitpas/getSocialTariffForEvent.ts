import { SimpleError } from '@simonbackx/simple-errors';

type StaticSocialTariffReponse = {
    available: Array<{
        price: number;
        // other properties ignored
    }>;
};

function assertsIsStaticSocialTariffResponse(json: unknown): asserts json is StaticSocialTariffReponse {
    if (
        typeof json !== 'object'
        || json === null
        || !('available' in json)
        || !Array.isArray(json.available)
        || !json.available.every(
            (item: unknown) => typeof item === 'object' && item !== null && 'price' in item && typeof item.price === 'number',
        )
    ) {
        console.error('Invalid response when getting static UiTPAS social tariff:', json);
        throw new SimpleError({
            code: 'invalid_response_getting_static_uitpas_social_tariff',
            message: `Invalid response when getting static UiTPAS social tariff`,
            human: $t(`Er is een fout opgetreden bij het ophalen van het kansentarief voor dit evenement. Probeer het later opnieuw.`),
        });
    }
}

export async function getSocialTariffForEvent(accessToken: string, useTestEnv: boolean, basePrice: number, uitpasEventUrl: string) {
    const baseUrl = useTestEnv ? 'https://api-test.uitpas.be' : 'https://api.uitpas.be';
    const params = new URLSearchParams();
    params.append('regularPrice', (basePrice / 100).toFixed(2));
    const eventId = uitpasEventUrl.split('/').pop(); // Extract the event ID from the URL
    if (!eventId) {
        throw new SimpleError({
            code: 'invalid_uitpas_event_url',
            message: `Invalid UiTPAS event URL: ${uitpasEventUrl}`,
            human: $t(`De opgegeven UiTPAS-evenement URL is ongeldig.`),
        });
    }
    params.append('eventId', eventId);
    const url = `${baseUrl}/tariffs/static?${params.toString()}`;
    const myHeaders = new Headers();
    myHeaders.append('Authorization', 'Bearer ' + accessToken);
    myHeaders.append('Accept', 'application/json');
    const requestOptions = {
        method: 'GET',
        headers: myHeaders,
    };
    const response = await fetch(url, requestOptions).catch(() => {
        // Handle network errors
        throw new SimpleError({
            code: 'uitpas_unreachable_getting_static_uitpas_social_tariff',
            message: `Network issue when getting static UiTPAS social tariff`,
            human: $t(
                `We konden UiTPAS niet bereiken om het kansentarief op te zoeken. Probeer het later opnieuw.`,
            ),
        });
    });
    if (!response.ok) {
        throw new SimpleError({
            code: 'unsuccessful_response_getting_static_uitpas_social_tariff',
            message: `Unsuccessful response when getting static UiTPAS social tariff`,
            human: $t(`Er is een fout opgetreden bij het verbinden met UiTPAS. Probeer het later opnieuw.`),
        });
    }
    const json = await response.json().catch(() => {
        // Handle JSON parsing errors
        throw new SimpleError({
            code: 'invalid_json_getting_static_uitpas_social_tariff',
            message: `Invalid json when getting static UiTPAS social tariff`,
            human: $t(
                `Er is een fout opgetreden bij het communiceren met UiTPAS. Probeer het later opnieuw.`,
            ),
        });
    });

    assertsIsStaticSocialTariffResponse(json);
    if (json.available.length === 0) {
        throw new SimpleError({
            code: 'no_social_tariff_available',
            message: `No social tariff available for event ${eventId}`,
            human: $t(`Er is geen kansentarief beschikbaar voor dit evenement.`),
        });
    }
    if (json.available.length > 1) {
        console.warn('Multiple social tariffs available for event', eventId, '(used ', json.available[0].price, ' as base price. All options:', json.available);
    }
    return Math.round(json.available[0].price * 100);
}
