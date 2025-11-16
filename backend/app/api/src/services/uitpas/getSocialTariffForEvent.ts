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
            human: $t(`a56854af-464a-45a4-8c39-10a9264b6ce4`),
        });
    }
}

export async function getSocialTariffForEvent(access_token: string, basePrice: number, uitpasEventUrl: string) {
    const baseUrl = 'https://api-test.uitpas.be/tariffs/static';
    const params = new URLSearchParams();
    params.append('regularPrice', (basePrice / 10_000).toFixed(2));
    const eventId = uitpasEventUrl.split('/').pop(); // Extract the event ID from the URL
    if (!eventId) {
        throw new SimpleError({
            code: 'invalid_uitpas_event_url',
            message: `Invalid UiTPAS event URL: ${uitpasEventUrl}`,
            human: $t(`85fb6e02-9b69-43cc-acf7-96a576461560`),
        });
    }
    params.append('eventId', eventId);
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
            human: $t(`ed4e876c-6a40-49a7-ab65-2a4d5f31c13f`),
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
            human: $t(`ccd8e8b4-01a7-4e7c-8ae0-92d2a4c659eb`),
        });
    }
    if (json.available.length > 1) {
        console.warn('Multiple social tariffs available for event', eventId, '(used ', json.available[0].price, ' as base price. All options:', json.available);
    }
    return Math.round(json.available[0].price * 100) * 100;
}
