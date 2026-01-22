import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { DataValidator } from '@stamhoofd/utility';

export type UitpasNumberSuccessfulResponse = {
    socialTariff: {
        status: 'ACTIVE' | 'EXPIRED' | 'NONE';
        endDate?: Date;
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

function hasType<T>(json: unknown): json is T & { type: string } {
    if (json && typeof json['type'] === 'string') {
        return true;
    }
    return false;
}

/**
 * Throws if any uitpasNumber is invalid.
 * @param access_token
 * @param uitpasNumber
 * @returns
 */
export async function throwIfInvalidUitpasNumber(access_token: string, uitpasNumber: string): Promise<UitpasNumberSuccessfulResponse> {
    const result = await checkUitpasNumber(access_token, uitpasNumber);

    if (result.error) {
        throw result.error;
    }

    return result.response;
}

/**
 * Checks uitpasNumber and returns an error without throwing if invalid
 * @param access_token
 * @param uitpasNumber
 * @returns
 */
export async function checkUitpasNumber(access_token: string, uitpasNumber: string): Promise<{ error: Error; response?: UitpasNumberSuccessfulResponse } | { response: UitpasNumberSuccessfulResponse; error?: undefined }> {
    // static check (using regex)
    if (!DataValidator.isUitpasNumberValid(uitpasNumber)) {
        return {
            error: new SimpleError({
                code: 'invalid_uitpas_number',
                message: `Invalid UiTPAS number: ${uitpasNumber}`,
                human: $t(
                    `Het opgegeven UiTPAS-nummer is ongeldig. Controleer het nummer en probeer het opnieuw.`,
                ),
            }),
        };
    }

    const baseUrl = 'https://api-test.uitpas.be'; // TO DO: Use the URL from environment variables

    const url = `${baseUrl}/passes/${uitpasNumber}`;
    const myHeaders = new Headers();
    myHeaders.append('Authorization', 'Bearer ' + access_token);
    const requestOptions = {
        method: 'GET',
        headers: myHeaders,
    };

    let response: Response;

    try {
        response = await fetch(url, requestOptions);
    }
    catch {
        return {
            error: new SimpleError({
                code: 'uitpas_unreachable_retrieving_pass_by_uitpas_number',
                message: `Network issue when retrieving pass by UiTPAS number`,
                human: $t(
                    `We konden UiTPAS niet bereiken om jouw UiTPAS-nummer te valideren. Probeer het later opnieuw.`,
                ),
            }),
        };
    }

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

            // handle specific errors
            if (hasType(json)) {
                // all possible error types:
                // https://docs.publiq.be/docs/uitpas/errors

                const type = json.type;
                if (type.endsWith('invalid-uitpas-number')) {
                    return {
                        error: new SimpleError({
                            statusCode: 404,
                            code: 'unknown_uitpas_number',
                            message: `Unknown UiTPAS number: ${uitpasNumber}`,
                            human: endUserMessage,
                        }),
                    };
                }
            }
        }

        return {
            error: endUserMessage
                ? new SimpleError({
                    code: 'unsuccessful_but_expected_response_retrieving_pass_by_uitpas_number',
                    message: `Unsuccesful response with message when retrieving pass by UiTPAS number, message: ${endUserMessage}`,
                    human: endUserMessage,
                })
                : new SimpleError({
                    code: 'unsuccessful_and_unexpected_response_retrieving_pass_by_uitpas_number',
                    message: `Unsuccesful response without message when retrieving pass by UiTPAS number`,
                    human: $t(`4c6482ff-e6d9-4ea1-b11d-e12d697b4b7b`),
                }),
        };
    }

    let json: any;

    try {
        json = await response.json();
    }
    catch {
        return {
            error: new SimpleError({
                code: 'invalid_json_retrieving_pass_by_uitpas_number',
                message: `Invalid json when retrieving pass by UiTPAS  number`,
                human: $t(
                    `Er is een fout opgetreden bij het communiceren met UiTPAS. Probeer het later opnieuw.`,
                ),
            }),
        };
    }

    try {
        assertIsUitpasNumberSuccessfulResponse(json);
    }
    catch (error) {
        return {
            error,
        };
    }

    // todo: is this correct? Are we sure that the uitpas is not active if messages are present?
    if (json.messages && json.messages.length > 0) {
        const humanMessage = json.messages[0].text; // only display the first message

        // alternatively, join all messages
        // const text = json.messages.map((message: any) => message.text).join(', ');

        return {
            error: new SimpleError({
                code: 'uitpas_number_issue',
                message: `UiTPAS API returned an error: ${humanMessage}`,
                human: humanMessage,
            }),
            response: json,
        };
    }

    if (json.socialTariff.status !== 'ACTIVE') {
        // THIS SHOULD NOT HAPPEN, as in that case json.messages should be present
        return {
            error: new SimpleError({
                code: 'non_active_social_tariff',
                message: `UiTPAS social tariff is not ACTIVE but ${json.socialTariff.status}`,
                human: $t(
                    `Het opgegeven UiTPAS-nummer heeft geen actief kansentarief. Neem contact op met de UiTPAS-organisatie voor meer informatie.`,
                ),
            }),
            response: json,
        };
    }

    // no errors -> the uitpas number is valid and social tariff is applicable
    return {
        response: json,
    };
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
            await throwIfInvalidUitpasNumber(access_token, uitpasNumber); // Throws if invalid
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
