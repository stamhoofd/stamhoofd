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

    static async handleInQueue<T>(organizationId: string | null, handler: () => Promise<T>): Promise<T> {
        return await QueueHandler.schedule('uitpas/token-' + (organizationId ?? 'platform'), handler);
    }

    static async storeIfValid(organizationId: string | null, clientId: string, clientSecret: string): Promise<boolean> {
        if (!clientId || !clientSecret) { // empty strings
            return false; // not valid
        }
        let model = new UitpasClientCredential();
        model.organizationId = organizationId;
        model.clientId = clientId;
        model.clientSecret = clientSecret;
        return await UitpasTokenRepository.handleInQueue(organizationId, async () => {
            let repo = new UitpasTokenRepository(model);
            try {
                await repo.getNewAccessToken();
            }
            catch (e) {
                return false; // not valid
            }
            // valid -> store
            model = await UitpasTokenRepository.setModelInDb(organizationId, model);
            repo.uitpasClientCredential = model; // update the uitpasClientCredential in the repo
            repo = UitpasTokenRepository.setRepoInMemory(organizationId, repo);
            return true;
        });
    }

    /**
     * organizationId (null means platform) -> UitpasTokenRepository
     */
    static knownTokens: Map<string | null, UitpasTokenRepository> = new Map();

    private static getRepoFromMemory(organizationId: string | null): UitpasTokenRepository | null {
        return UitpasTokenRepository.knownTokens.get(organizationId) ?? null;
    }

    private static async getModelFromDb(organizationId: string | null) {
        if (organizationId === null) {
            // platform client id and secret are not yet in the database, but should be configured in the environment variables
            if (!STAMHOOFD.UITPAS_API_CLIENT_ID || !STAMHOOFD.UITPAS_API_CLIENT_SECRET) {
                throw new SimpleError({
                    code: 'uitpas_api_not_configured_for_platform',
                    message: 'UiTPAS api is not configured for the platform',
                    human: $t('71a8218b-c58e-4e95-9626-551b80eb8367'),
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
            if (response.status === 401) {
                // Unauthorized, credentials are invalid
                throw new SimpleError({
                    code: 'invalid_uitpas_client_credentials',
                    message: `Invalid UiTPAS client credentials`,
                    human: $t(`1086bb24-5df4-4faf-9dc0-ab5a955b0d8f`),
                });
            }
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

    private static setRepoInMemory(organizationId: string | null, repo: UitpasTokenRepository) {
        UitpasTokenRepository.knownTokens.set(organizationId, repo);
        return repo;
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
    static async getAccessTokenFor(organizationId: string | null = null, forceRefresh: boolean = false): Promise<string> {
        let repo = UitpasTokenRepository.getRepoFromMemory(organizationId);
        if (repo && repo.accessToken && !forceRefresh && repo.expiresOn > new Date()) {
            return repo.accessToken;
        }

        // Prevent multiple concurrent requests for the same organization, asking for an access token to the UiTPAS API.
        // The queue can only run one at a time for the same organizationId
        return await UitpasTokenRepository.handleInQueue(organizationId, async () => {
            // we re-search for the repo, as another call to this funcion might have added while we we're waiting in the queue
            repo = UitpasTokenRepository.getRepoFromMemory(organizationId);
            if (repo && repo.accessToken && !forceRefresh && repo.expiresOn > new Date()) {
                return repo.accessToken;
            }
            if (!repo) {
                const model = await UitpasTokenRepository.getModelFromDb(organizationId);
                if (!model) {
                    throw new SimpleError({
                        code: 'uitpas_api_not_configured_for_this_organization',
                        message: `UiTPAS api not configured for organization with id ${organizationId}`,
                        human: $t('6b333cb4-21fd-42be-b0c9-6d899f2fd348'),
                    });
                }
                repo = UitpasTokenRepository.setRepoInMemory(organizationId, new UitpasTokenRepository(model)); // store in memory
            }
            // ask for a new access token
            return repo.getNewAccessToken();
        });
    }

    static async getClientIdFor(organizationId: string | null): Promise<string> {
        const repo = UitpasTokenRepository.getRepoFromMemory(organizationId);
        if (!repo) {
            const model = await UitpasClientCredential.select().where('organizationId', organizationId).first(false);
            if (!model) {
                return ''; // no client ID and secret configured
            }
            return model.clientId; // client ID configured, but not in memory
        }
        return repo.uitpasClientCredential.clientId; // client ID configured and in memory
    }

    static async clearClientCredentialsFor(organizationId: string | null): Promise<boolean> {
        return await UitpasTokenRepository.handleInQueue(organizationId, async () => {
            const repo = UitpasTokenRepository.getRepoFromMemory(organizationId);
            if (repo) {
                // in memory, thus also in db
                await repo.uitpasClientCredential.delete(); // remove from db
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
