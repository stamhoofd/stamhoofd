import { SimpleError } from '@simonbackx/simple-errors';
import { UitpasClientCredential } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';

type UitpasTokenResponse = {
    access_token: string;
    expires_in: number;
};

function assertIsUitpasTokenResponse(json: unknown): asserts json is UitpasTokenResponse {
    if (
        typeof json !== 'object'
        || json === null
        || !('access_token' in json)
        || !('expires_in' in json)
        || typeof json.access_token !== 'string'
        || typeof json.expires_in !== 'number'
        || json.expires_in <= 0
    ) {
        console.error('Invalid response when fetching UiTPAS token:', json);
        throw new SimpleError({
            code: 'invalid_response_fetching_uitpas_token',
            message: `Invalid response when fetching UiTPAS token`,
            human: $t(`8f217db0-c672-46f0-a8f7-6eba6f080947`),
        });
    }
}

export class UitpasTokenRepository {
    accessToken?: string;
    expiresOn: Date = new Date(0); // Set to minimum time initially
    uitpasClientCredential: UitpasClientCredential;

    constructor(uitpasClientCredential: UitpasClientCredential) {
        this.uitpasClientCredential = uitpasClientCredential;
    }

    /**
     * organizationId (null means platform) -> UitpasTokenRepository
     */
    static knownTokens: Map<string | null, UitpasTokenRepository> = new Map();

    private static async createRepoFromDb(organizationId: string | null): Promise<UitpasTokenRepository> {
        // query db
        let uitpasClientCredential = await UitpasClientCredential.select().where('organizationId', organizationId).first(false);
        if (!uitpasClientCredential) {
            // temporary solution, because platform client id and secret are not yet in the database
            if (organizationId === null) {
                if (!STAMHOOFD.UITPAS_API_CLIENT_ID || !STAMHOOFD.UITPAS_API_CLIENT_SECRET) {
                    throw new SimpleError({
                        code: 'uitpas_api_not_configured_for_platform',
                        message: 'UiTPAS api is not configured for the platform',
                        human: $t('e0b65e04-6cef-41e1-9b45-6b6c56e5356a'),
                    });
                }
                uitpasClientCredential = new UitpasClientCredential();
                uitpasClientCredential.clientId = STAMHOOFD.UITPAS_API_CLIENT_ID;
                uitpasClientCredential.clientSecret = STAMHOOFD.UITPAS_API_CLIENT_SECRET;
                uitpasClientCredential.organizationId = null; // null means platform
            }
            else {
                throw new SimpleError({
                    code: 'uitpas_api_not_configured_for_this_organization',
                    message: `UiTPAS api not configured for organization with id ${organizationId}`,
                    human: $t(`f74aa987-0f92-4701-861d-2512efc5dda1`),
                });
            }
        }
        const newRepo = new UitpasTokenRepository(uitpasClientCredential);
        this.knownTokens.set(organizationId, newRepo);
        return newRepo;
    }

    private async getNewAccessToken(): Promise<string> {
        const url = 'https://account-test.uitid.be/realms/uitid/protocol/openid-connect/token';
        const myHeaders = new Headers();
        myHeaders.append('Content-Type', 'application/x-www-form-urlencoded');
        const params = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.uitpasClientCredential.clientId,
            client_secret: this.uitpasClientCredential.clientSecret,
        });
        const requestOptions: RequestInit = {
            method: 'POST',
            headers: myHeaders,
            body: params.toString(),
        };
        const response = await fetch(url, requestOptions).catch(() => {
            // Handle network errors
            throw new SimpleError({
                code: 'uitpas_unreachable_fetching_uitpas_token',
                message: `Network issue when fetching UiTPAS  token`,
                human: $t(`6483c4c6-2fe8-456d-9110-f565952b6822`),
            });
        });
        if (!response.ok) {
            console.error(`Unsuccessful response when fetching UiTPAS token for organization with id ${this.uitpasClientCredential.organizationId}:`, response.statusText);
            throw new SimpleError({
                code: 'unsuccessful_response_fetching_uitpas_token',
                message: `Unsuccesful response when fetching UiTPAS token`,
                human: $t(`dd9b30ca-860f-47aa-8cb1-527fd156d9ca`),
            });
        }
        const json: unknown = await response.json().catch(() => {
            // Handle JSON parsing errors
            throw new SimpleError({
                code: 'invalid_json_fetching_uitpas_token',
                message: `Invalid json when fetching UiTPAS token`,
                human: $t(`8f217db0-c672-46f0-a8f7-6eba6f080947`),
            });
        });
        assertIsUitpasTokenResponse(json);
        this.accessToken = json.access_token;
        this.expiresOn = new Date((Date.now() + json.expires_in * 1000) - 10000); // Set expiration 10 seconds earlier to be safe
        return this.accessToken;
    }

    /**
     * Get the access token for the organization or platform.
     * @param organizationId the organization ID for which to get the access token. If null, it means the platform.
     * @param forceRefresh if true, the access token will be refreshed even if a previously stored token it is still valid
     * @returns Promise<string> the access token for the organization or platform
     * @throws SimpleError if the token cannot be obtained or the API is not configured
     */
    static async getAccessTokenFor(organizationId: string | null = null, forceRefresh: boolean = false): Promise<string> {
        let repo = UitpasTokenRepository.knownTokens.get(organizationId);
        if (repo && repo.accessToken && !forceRefresh && repo.expiresOn > new Date()) {
            return repo.accessToken;
        }

        // Prevent multiple concurrent requests for the same organization, asking for an access token to the UiTPAS API.
        // The queue can only run one at a time for the same organizationId
        return await QueueHandler.schedule('uitpas/token-' + (organizationId ?? 'platform'), async () => {
            // we re-search for the repo, as another call to this funcion might have added while we we're waiting in the queue
            repo = UitpasTokenRepository.knownTokens.get(organizationId);
            if (repo && repo.accessToken && !forceRefresh && repo.expiresOn > new Date()) {
                return repo.accessToken;
            }
            if (!repo) {
                repo = await UitpasTokenRepository.createRepoFromDb(organizationId);
            }
            // ask for a new access token
            return repo.getNewAccessToken(); ;
        });
    }
}
