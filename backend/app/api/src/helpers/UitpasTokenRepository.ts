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
            human: $t(`%18A`),
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

    static async handleInQueue<T>(organizationId: string | null, handler: () => Promise<T>): Promise<T> {
        return await QueueHandler.schedule('uitpas/token-' + (organizationId ?? 'platform'), handler);
    }

    static async storeIfValid(organizationId: string | null, clientId: string, clientSecret: string): Promise<void> {
        if (!clientId || !clientSecret) { // empty strings
            throw new SimpleError({
                statusCode: 400,
                code: 'invalid_uitpas_client_credentials',
                message: `Empty UiTPAS client credentials`,
                human: $t(`%ZdU`),
            });
        }

        let model = new UitpasClientCredential();
        model.organizationId = organizationId;
        model.clientId = clientId;
        model.clientSecret = clientSecret;
        await UitpasTokenRepository.handleInQueue(organizationId, async () => {
            const repo = new UitpasTokenRepository(model);
            await repo.getNewAccessToken();
            // valid -> store
            model = await UitpasTokenRepository.setModelInDb(organizationId, model);
            repo.uitpasClientCredential = model; // update the uitpasClientCredential in the repo
            UitpasTokenRepository.setRepoInMemory(organizationId, repo);
        });
    }

    /**
     * organizationId (null means platform) -> UitpasTokenRepository or null if no creds are configured for this org/platform
     */
    private static knownTokens: Map<string | null, UitpasTokenRepository | null> = new Map();

    /**
     * @returns null if no creds configured, undefined if not found in memory, UitpasTokenRepository if found in memory
     */
    private static getRepoFromMemory(organizationId: string | null): UitpasTokenRepository | undefined | null {
        return UitpasTokenRepository.knownTokens.get(organizationId);
    }

    private static async getModelFromDb(organizationId: string | null) {
        if (organizationId === null) {
            // platform client id and secret are not yet in the database, but should be configured in the environment variables
            if (!STAMHOOFD.UITPAS_API_CLIENT_ID || !STAMHOOFD.UITPAS_API_CLIENT_SECRET) {
                throw new SimpleError({
                    code: 'uitpas_api_not_configured_for_platform',
                    message: 'UiTPAS api is not configured for the platform',
                    human: $t('%1BI'),
                });
            }
            const model = new UitpasClientCredential();
            model.clientId = STAMHOOFD.UITPAS_API_CLIENT_ID;
            model.clientSecret = STAMHOOFD.UITPAS_API_CLIENT_SECRET;
            model.organizationId = null; // null means platform
            return model;
        }

        const model = await UitpasClientCredential.select().where('organizationId', organizationId).first(false);
        if (model) {
            return model; // found in database
        }

        return null; // not found in database
    }

    private async getNewAccessToken() {
        console.log('UITPAS: Fetching new access token for', this.uitpasClientCredential.organizationId);
        const url = STAMHOOFD.UITPAS_API_URL?.includes('test') ? 'https://account-test.uitid.be/realms/uitid/protocol/openid-connect/token' : 'https://account.uitid.be/realms/uitid/protocol/openid-connect/token';
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
            signal: AbortSignal.timeout(5000),
        };
        const response = await fetch(url, requestOptions).catch(() => {
            // Handle network errors
            throw new SimpleError({
                code: 'uitpas_unreachable_fetching_uitpas_token',
                message: `Network issue when fetching UiTPAS  token`,
                human: $t(`%18B`),
            });
        });
        if (!response.ok) {
            if (response.status === 401) {
                // Unauthorized, credentials are invalid
                throw new SimpleError({
                    statusCode: this.uitpasClientCredential.organizationId === null ? 500 : 400, // Internal, non visible error in case it is a built in credential
                    code: 'invalid_uitpas_client_credentials',
                    message: `Invalid UiTPAS client credentials`,
                    human: $t(`%1BK`),
                });
            }
            console.error(`Unsuccessful response when fetching UiTPAS token for organization with id ${this.uitpasClientCredential.organizationId}:`, response.statusText);
            throw new SimpleError({
                statusCode: this.uitpasClientCredential.organizationId === null ? 500 : 400, // Internal, non visible error in case it is a built in credential
                code: 'unsuccessful_response_fetching_uitpas_token',
                message: `Unsuccesful response when fetching UiTPAS token`,
                human: $t(`%18C`),
            });
        }
        const json: unknown = await response.json().catch(() => {
            // Handle JSON parsing errors
            throw new SimpleError({
                statusCode: this.uitpasClientCredential.organizationId === null ? 500 : 400, // Internal, non visible error in case it is a built in credential
                code: 'invalid_json_fetching_uitpas_token',
                message: `Invalid json when fetching UiTPAS token`,
                human: $t(`%18A`),
            });
        });
        assertIsUitpasTokenResponse(json);
        this.accessToken = json.access_token;
        this.expiresOn = new Date((Date.now() + json.expires_in * 1000) - 10000); // Set expiration 10 seconds earlier to be safe
        return this.accessToken;
    }

    private static setRepoInMemory(organizationId: string | null, repo: UitpasTokenRepository | null) {
        UitpasTokenRepository.knownTokens.set(organizationId, repo);
    }

    private static async setModelInDb(organizationId: string | null, model: UitpasClientCredential) {
        const oldModel = await UitpasTokenRepository.getModelFromDb(organizationId);
        if (oldModel) {
            // update
            oldModel.clientId = model.clientId;
            oldModel.clientSecret = model.clientSecret;
            await oldModel.save();
            return oldModel; // return updated model
        }
        // create
        await model.save();
        return model; // return new model
    }

    /**
     * Get the access token for the organization or platform.
     * @param organizationId the organization ID for which to get the access token. If null, it means the platform.
     * @param forceRefresh if true, the access token will be refreshed even if a previously stored token it is still valid
     * @returns Promise<string> the access token for the organization or platform
     * @throws SimpleError if the token cannot be obtained or the API is not configured
     */
    static async getAccessTokenFor(organizationId: string | null, forceRefresh: boolean = false): Promise<string> {
        const notConfiguredError = new SimpleError({
            code: 'uitpas_api_not_configured_for_this_organization',
            message: `UiTPAS api not configured for organization with id ${organizationId}`,
            human: $t('%1BJ'),
        });

        const tryFromMemory = (): string | UitpasTokenRepository | undefined => {
            const cached = UitpasTokenRepository.getRepoFromMemory(organizationId);
            if (cached === null) {
                throw notConfiguredError;
            }
            if (cached && cached.accessToken && !forceRefresh && cached.expiresOn > new Date()) {
                return cached.accessToken;
            }
            return cached; // not found in memory or expired or no access token or forceRefresh
        };

        const memoryResult = tryFromMemory();
        if (typeof memoryResult === 'string') {
            return memoryResult; // access token found in memory
        }

        // Prevent multiple concurrent requests for the same organization, asking for an access token to the UiTPAS API.
        // The queue can only run one at a time for the same organizationId
        return await UitpasTokenRepository.handleInQueue(organizationId, async () => {
            // we re-search for the repo, as another call to this funcion might have added while we we're waiting in the queue
            let repo: UitpasTokenRepository;
            const memoryResult = tryFromMemory();
            if (typeof memoryResult === 'string') {
                return memoryResult; // access token found in memory
            }
            if (!memoryResult) {
                const model = await UitpasTokenRepository.getModelFromDb(organizationId);
                if (!model) {
                    UitpasTokenRepository.setRepoInMemory(organizationId, null);
                    throw notConfiguredError;
                }
                repo = new UitpasTokenRepository(model);
                UitpasTokenRepository.setRepoInMemory(organizationId, repo);
            } else {
                repo = memoryResult;
            }
            // ask for a new access token
            return await repo.getNewAccessToken();
        });
    }

    static async getClientIdFor(organizationId: string): Promise<string> {
        const tryFromMemory = (): string | undefined => {
            const cached = UitpasTokenRepository.getRepoFromMemory(organizationId);
            if (cached === null) {
                return '';
            }
            if (cached) {
                return cached.uitpasClientCredential.clientId;
            }
        };

        const memoryResult = tryFromMemory();
        if (typeof memoryResult === 'string') {
            return memoryResult; // client ID found in memory
        }

        return await UitpasTokenRepository.handleInQueue(organizationId, async () => {
            // re-search memory, as another call to this function might have populated it while we were waiting in the queue
            const memoryResult = tryFromMemory();
            if (typeof memoryResult === 'string') {
                return memoryResult; // client ID found in memory
            }
            const model = await UitpasTokenRepository.getModelFromDb(organizationId);
            if (!model) {
                UitpasTokenRepository.setRepoInMemory(organizationId, null); // remember there are no creds configured
                return '';
            }
            UitpasTokenRepository.setRepoInMemory(organizationId, new UitpasTokenRepository(model)); // store in memory
            return model.clientId; // client ID configured, now also in memory
        });
    }

    static async clearClientCredentialsFor(organizationId: string | null): Promise<boolean> {
        return await UitpasTokenRepository.handleInQueue(organizationId, async () => {
            const cached = UitpasTokenRepository.getRepoFromMemory(organizationId);
            if (cached === null) {
                return false; // nothing to clear
            }
            if (cached) {
                // in memory, thus also in db
                await cached.uitpasClientCredential.delete(); // remove from db
                UitpasTokenRepository.knownTokens.delete(organizationId); // remove from memory
                return true;
            }
            // not in memory, maybe in db
            const model = await UitpasTokenRepository.getModelFromDb(organizationId);
            if (model) {
                await model.delete(); // remove from database
                return true;
            }
            return false; // nothing to clear
        });
    }
}
