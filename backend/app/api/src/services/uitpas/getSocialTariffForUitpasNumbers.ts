import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { UitpasNumberAndPrice } from '@stamhoofd/structures';

type SocialTariffReponse = {
    available: Array<{
        id: string;
        price: number;
        remaining: number;
        // other properties ignored
    }>;
    endUserMessage?: {
        nl: string;
    };
};

type SocialTariffErrorResponse = {
    title: string; // e.g., "Invalid uitpas number"
    endUserMessage?: {
        nl: string;
    };
};

function assertsIsSocialTariffResponse(json: unknown): asserts json is SocialTariffReponse {
    if (
        typeof json !== 'object'
        || json === null
        || !('available' in json)
        || !Array.isArray(json.available)
        || !json.available.every(
            (item: unknown) => typeof item === 'object' && item !== null && 'id' in item && typeof item.id === 'string' && 'price' in item && typeof item.price === 'number' && 'remaining' in item && typeof item.remaining === 'number',
        )
    ) {
        console.error('Invalid response when getting UiTPAS social tariff:', json);
        throw new SimpleError({
            code: 'invalid_response_getting_uitpas_social_tariff',
            message: `Invalid response when getting UiTPAS social tariff`,
            human: $t(`466844b9-c042-4bc7-b77d-3f87376086b5`),
        });
    }
}

function isSocialTariffErrorResponse(
    json: unknown,
): json is SocialTariffErrorResponse {
    return typeof json === 'object'
        && json !== null
        && 'title' in json
        && typeof json.title === 'string'
        && (!('endUserMessage' in json)
            || (typeof json.endUserMessage === 'object' && json.endUserMessage !== null && 'nl' in json.endUserMessage && typeof json.endUserMessage.nl === 'string')
        );
}

async function getSocialTariffForUitpasNumber(access_token: string, uitpasNumber: string, basePrice: number, uitpasEventUrl: string) {
    const baseUrl = 'https://api-test.uitpas.be/tariffs';
    const params = new URLSearchParams();
    params.append('regularPrice', (basePrice / 1_0000).toFixed(2));
    const eventId = uitpasEventUrl.split('/').pop();
    if (!eventId) {
        throw new SimpleError({
            code: 'invalid_uitpas_event_url',
            message: `Invalid UiTPAS event URL: ${uitpasEventUrl}`,
            human: $t(`85fb6e02-9b69-43cc-acf7-96a576461560`),
        });
    }
    params.append('eventId', eventId);
    params.append('uitpasNumber', uitpasNumber);
    params.append('type', 'SOCIALTARIFF'); // this ensures we get the social tariff or a message that explains why it's not available
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
                `We konden UiTPAS niet bereiken om jouw kansentarief op te zoeken. Probeer het later opnieuw.`,
            ),
        });
    });
    if (!response.ok) {
        const json: unknown = await response.json().catch(() => { /* ignore */ });
        let endUserMessage = '';

        if (json) {
            console.error(`UiTPAS API returned an error for UiTPAS number ${uitpasNumber} with event id ${eventId}:`, json);
        }
        else {
            console.error(`UiTPAS API returned an error for UiTPAS number ${uitpasNumber} with event id ${eventId}:`, response.statusText);
        }

        if (isSocialTariffErrorResponse(json)) {
            endUserMessage = json.endUserMessage ? json.endUserMessage.nl : '';
        }

        if (endUserMessage) {
            throw new SimpleError({
                code: 'unsuccessful_but_expected_response_retrieving_social_tariff_by_uitpas_number',
                message: `Unsuccesful response with message when retrieving social tariff by UiTPAS number, message: ${endUserMessage}`,
                human: endUserMessage,
            });
        }

        throw new SimpleError({
            code: 'unsuccessful_and_unexpected_response_retrieving_social_tariff_by_uitpas_number',
            message: `Unsuccesful response without message when retrieving social tariff by UiTPAS number`,
            human: $t(`1572d069-abda-4b31-a373-f0c3760c79b1`),
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

    assertsIsSocialTariffResponse(json);
    if (json.available.length === 0) {
        if (json.endUserMessage) {
            throw new SimpleError({
                code: 'no_social_tariff_available_with_message',
                message: `No social tariff available for event ${uitpasEventUrl} with message`,
                human: json.endUserMessage.nl,
            });
        }
        throw new SimpleError({
            code: 'no_social_tariff_available',
            message: `No social tariff available for event ${uitpasEventUrl}`,
            human: $t(`ccd8e8b4-01a7-4e7c-8ae0-92d2a4c659eb`),
        });
    }
    if (json.available.length > 1) {
        console.warn('Multiple social tariffs available for event', uitpasEventUrl, '(used ', json.available[0].price, ' as base price. All options:', json.available);
    }
    if (json.endUserMessage) {
        console.warn('UiTPAS API returned an end user message for event', uitpasEventUrl, ':', json.endUserMessage.nl);
        console.warn('This message was not shown to the user, as a social tariff wass available.');
    }
    if (json.available[0].remaining < 1) {
        throw new SimpleError({
            code: 'no_remaining_social_tariff',
            message: `No remaining social tariff for event ${uitpasEventUrl} and UiTPAS number ${uitpasNumber}`,
            human: $t(`f9d6bc51-e7c9-4d3f-a13f-27871a018d83`),
        });
    }
    console.log('Social tariff for UiTPAS number', uitpasNumber, 'with event id', uitpasEventUrl, 'is', json.available[0].price, 'euros');
    return UitpasNumberAndPrice.create({
        uitpasNumber,
        price: Math.round((json.available[0].price) * 100) * 100,
        uitpasTariffId: json.available[0].id,
    });
}

export async function getSocialTariffForUitpasNumbers(access_token: string, uitpasNumbers: string[], basePrice: number, uitpasEventUrl: string) {
    const simpleErrors = new SimpleErrors();
    const reducedPrices = new Array<UitpasNumberAndPrice>(uitpasNumbers.length);
    for (let i = 0; i < uitpasNumbers.length; i++) {
        const uitpasNumber = uitpasNumbers[i];
        try {
            reducedPrices[i] = await getSocialTariffForUitpasNumber(access_token, uitpasNumber, basePrice, uitpasEventUrl);
        }
        catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                e.addNamespace(i.toString());
                e.addNamespace('uitpasNumbers');
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
    return reducedPrices;
}
