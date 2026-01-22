import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { DataValidator } from '@stamhoofd/utility';

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
            human: $t(`4c6482ff-e6d9-4ea1-b11d-e12d697b4b7b`),
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

async function checkUitpasNumber(access_token: string, uitpasNumber: string) {
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
            human: $t(`4c6482ff-e6d9-4ea1-b11d-e12d697b4b7b`),
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
    if (json.messages && json.messages.length > 0) {
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
export async function checkUitpasNumbers(access_token: string, uitpasNumbers: string[]) {
    const simpleErrors = new SimpleErrors();
    for (let i = 0; i < uitpasNumbers.length; i++) {
        const uitpasNumber = uitpasNumbers[i];
        try {
            await checkUitpasNumber(access_token, uitpasNumber); // Throws if invalid
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
}
