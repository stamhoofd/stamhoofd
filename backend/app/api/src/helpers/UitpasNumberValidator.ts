import { SimpleError } from '@simonbackx/simple-errors';
import { UitpasTokenRepository } from './UitpasTokenRepository';
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
    ) {
        throw new SimpleError({
            code: 'invalid_response_getting_pass_by_uitpas_number',
            message: `Invalid response when fetching pass by UiTPAS number: ${JSON.stringify(json)}`,
            human: $t(`Er is een fout opgetreden bij de communicatie met UiTPAS. Probeer het later opnieuw.`),
        });
    }
}

function assertIsUitpasNumberErrorResponse(
    json: unknown,
): asserts json is UitpasNumberErrorResponse {
    if (
        typeof json !== 'object'
        || json === null
        || !('title' in json)
        || typeof json.title !== 'string'
        || ('endUserMessage' in json && (typeof json.endUserMessage !== 'object' || json.endUserMessage === null || !('nl' in json.endUserMessage) || typeof json.endUserMessage.nl !== 'string'))
    ) {
        throw new SimpleError({
            code: 'invalid_error_response_getting_pass_by_uitpas_number',
            message: `Invalid error response when fetching pass by UiTPAS number: ${JSON.stringify(json)}`,
            human: $t(`Er is een fout opgetreden bij de communicatie met UiTPAS. Probeer het later opnieuw.`),
        });
    }
}

export class UitpasNumberValidatorStatic {
    async checkUitpasNumber(uitpasNumber: string) {
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
        if (!STAMHOOFD.UITPAS_API_CLIENT_ID) {
            throw new SimpleError({
                code: 'uitpas_api_not_configured',
                message: 'UiTPAS API is not configured',
                human: $t(
                    'UiTPAS is niet volledig geconfigureerd. Neem contact op met de beheerder.',
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

        const response = await fetch(url, requestOptions).catch((error) => {
            // Handle network errors
            throw new SimpleError({
                code: 'uitpas_unreachable',
                message: `Error retrieving pass by UiTPAS number: ${error.message}`,
                human: $t(
                    `De verbinding met UiTPAS is mislukt, dus konden we je UiTPAS-nummer niet valideren. Probeer het later opnieuw.`,
                ),
            });
        });
        if (!response.ok) {
            // we use a generic error message and try to parse the response to get a better message
            let humanErrorMessage = $t(`Er is een fout opgetreden bij het ophalen van je UiTPAS. Kijk je het nummer even na?`);

            const json = await response.json().catch(() => { /* ignore */ });
            try {
                assertIsUitpasNumberErrorResponse(json);
                if (json.endUserMessage) {
                    humanErrorMessage = json.endUserMessage.nl;
                }
            }
            catch { /* ignore */ }

            // in all cases, we throw an error
            throw new SimpleError({
                code: 'error_retrieving_pass_by_uitpas_number',
                message: `Error retrieving pass by UiTPAS number: ${json?.title || response.statusText}`,
                human: humanErrorMessage,
            });
        }

        const json = await response.json().catch((error) => {
            // Handle JSON parsing errors
            throw new SimpleError({
                code: 'invalid_json_response',
                message: `Invalid JSON response from UiTPAS API: ${error.message}`,
                human: $t(
                    `Er is een fout opgetreden bij het verwerken van de UiTPAS-gegevens. Probeer het later opnieuw.`,
                ),
            });
        });
        assertIsUitpasNumberSuccessfulResponse(json);
        if (json.messages) {
            const text = json.messages[0].text; // only display the first message

            // alternatively, join all messages
            // const text = json.messages.map((message: any) => message.text).join(', ');

            throw new SimpleError({
                code: 'uitpas_number_issue',
                message: `UiTPAS API returned an error: ${json.messages[0].text}`,
                human: text,
            });
        }
        if (json.socialTariff.status !== 'ACTIVE') {
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
}

export const UitpasNumberValidator = new UitpasNumberValidatorStatic();
