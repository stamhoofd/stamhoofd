import { SimpleError } from '@simonbackx/simple-errors';
import { UitpasToken } from '@stamhoofd/models';

export class UitpasTokenRepository {
    accessToken?: string;
    expiresOn: Date = new Date(0); // Set to minimum time initially
    uitpasToken: UitpasToken;

    constructor(uitpasToken: UitpasToken) {
        this.uitpasToken = uitpasToken;
    }

    /**
     * organizationId (null means platform) -> UitpasTokenRepository
     */
    static knownTokens: Map<string | null, UitpasTokenRepository> = new Map();

    /**
     * Get the access token for the organization or platform.
     * @param organizationId the organization ID for which to get the access token. If null, it means the platform.
     * @param forceRefresh if true, the access token will be refreshed even if a previously stored token it is still valid
     * @returns Promise<string> the access token for the organization or platform
     * @throws SimpleError if the token cannot be obtained or the API is not configured
     */
    static async getAccessTokenFor(organizationId: string | null = null, forceRefresh: boolean = false): Promise<string> {
        const repo = UitpasTokenRepository.knownTokens.get(organizationId);
        if (repo) {
            return repo.getAccessToken(forceRefresh);
        }
        // query db
        let uitpasToken = await UitpasToken.select().where('organizationId', organizationId).first(false);
        if (!uitpasToken) {
            // temporary solution, because platform client id and secret are not yet in the database
            if (organizationId === null) {
                if (!STAMHOOFD.UITPAS_API_CLIENT_ID || !STAMHOOFD.UITPAS_API_CLIENT_SECRET) {
                    throw new SimpleError({
                        code: 'uitpas_api_not_configured',
                        message: 'UiTPAS API is not configured',
                        human: $t('UiTPAS is niet volledig geconfigureerd. Neem contact op met de platformbeheerder.'),
                    });
                }
                uitpasToken = new UitpasToken();
                uitpasToken.clientId = STAMHOOFD.UITPAS_API_CLIENT_ID;
                uitpasToken.clientSecret = STAMHOOFD.UITPAS_API_CLIENT_SECRET;
                uitpasToken.organizationId = null; // null means platform
            }
            else {
                throw new SimpleError({
                    code: 'uitpas_token_not_found',
                    message: organizationId ? `Uitpas token not found for clientId ${organizationId}` : 'Uitpas token not found for platform',
                    human: $t(`De UiTPAS integratie is niet compleet, contacteer de beheerder.`),
                });
            }
        }
        const newRepo = new UitpasTokenRepository(uitpasToken);
        this.knownTokens.set(organizationId, newRepo);
        return newRepo.getAccessToken(true);
    }

    private async getAccessToken(forceRefresh: boolean = false): Promise<string> {
        if (this.accessToken && !forceRefresh && this.expiresOn > new Date()) {
            return this.accessToken;
        }
        const url = 'https://account-test.uitid.be/realms/uitid/protocol/openid-connect/token';
        const myHeaders = new Headers();
        myHeaders.append('Content-Type', 'application/x-www-form-urlencoded');
        const params = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.uitpasToken.clientId,
            client_secret: this.uitpasToken.clientSecret,
        });
        const requestOptions: RequestInit = {
            method: 'POST',
            headers: myHeaders,
            body: params.toString(),
        };
        const response = await fetch(url, requestOptions).catch((error) => {
            // Handle network errors
            throw new SimpleError({
                code: 'uitpas_unreachable',
                message: `Network error when fetching UiTPAS token for client id ${this.uitpasToken.clientId}: ${error.message}`,
                human: $t(`We konden UiTPAS niet bereiken. Probeer het later opnieuw.`),
            });
        });
        if (!response.ok) {
            // Handle non-200 responses
            throw new SimpleError({
                code: 'unsuccessful_response_fetching_uitpas_token',
                message: `Could not successfully obtain an UiTPAS token for client id ${this.uitpasToken.clientId}: ${response.statusText}`,
                human: $t(`Er is een fout opgetreden bij het verbinden met UiTPAS. Probeer het later opnieuw.`),
            });
        }
        const json = await response.json().catch((error) => {
            // Handle JSON parsing errors
            throw new SimpleError({
                code: 'invalid_json_response_fetching_uitpas_token',
                message: `Invalid JSON response when fetching UiTPAS token for client id ${this.uitpasToken.clientId}: ${error.message}`,
                human: $t(`Er is een fout opgetreden bij het communiceren met UiTPAS. Probeer het later opnieuw.`),
            });
        });
        if (!json.access_token || typeof json.access_token === 'string' || !json.expires_in || typeof json.expires_in !== 'number' || json.expires_in <= 0) {
            // Handle invalid response
            throw new SimpleError({
                code: 'invalid_response_fetching_uitpas_token',
                message: `Invalid response when fetching UiTPAS token for client id ${this.uitpasToken.clientId}: ${JSON.stringify(json)}`,
                human: $t(`Er is een fout opgetreden bij de communicatie met UiTPAS. Probeer het later opnieuw.`),
            });
        }
        this.accessToken = json.access_token;
        this.expiresOn = new Date((Date.now() + json.expires_in * 1000) - 10000); // Set expiration 10 seconds earlier to be safe
        return this.accessToken!;
    }
}
