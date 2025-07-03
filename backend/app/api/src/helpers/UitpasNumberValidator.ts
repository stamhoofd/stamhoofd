import { SimpleError } from '@simonbackx/simple-errors';
import { UitpasTokenRepository } from './UitpasTokenRepository';
import { DataValidator } from '@stamhoofd/utility';

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
            // Handle non-200 responses by attempting to parse the response to get a message from UiTPAS API
            const json = await response.json().catch(() => {}); // Ignore JSON parsing errors -> we will throw a generic error below
            if (
                json
                && json.endUserMessage
                && json.endUserMessage.nl
                && typeof json.endUserMessage.nl === 'string'
                && json.title
                && typeof json.title === 'string'
            ) {
                // If the response contains an endUserMessage, throw an error with that message
                throw new SimpleError({
                    code: 'error_retrieving_pass_by_uitpas_number',
                    message: `UiTPAS API returned an error: ${json.title}`,
                    human: json.endUserMessage,
                });
            }
            throw new SimpleError({
                code: 'bad_response_when_fetching_uitpas_number',
                message: `Unsuccessful response from UiTPAS API: ${response.statusText}`,
                human: $t(
                    `Er is een fout opgetreden bij het ophalen van je UiTPAS. Probeer het later opnieuw.`,
                ),
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
        if (!json || !json.socialTariff || !json.socialTariff.status) {
            throw new SimpleError({
                code: 'invalid_json_response',
                message: `Invalid JSON response from UiTPAS API: ${JSON.stringify(json)}`,
                human: $t(
                    `Er is een fout opgetreden bij het verwerken van de UiTPAS-gegevens. Probeer het later opnieuw.`,
                ),
            });
        }
        if (
            json.messages
            && Array.isArray(json.messages)
            && json.messages.length > 0
            && json.messages[0].message
            && json.messages[0].message.text
        ) {
            const text = json.messages[0].text; // only display the first message

            // alternatively, join all messages
            // const text = json.messages.map((message: any) => message.text).join(', ');

            // If there are messages, throw an error with the first message
            throw new SimpleError({
                code: 'uitpas_number_issue',
                message: `UiTPAS API returned an error: ${json.messages[0].message}`,
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
