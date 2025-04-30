import { column } from '@simonbackx/simple-database';
import { PartialWithoutMethods, PlainObject } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { QueryableModel } from '@stamhoofd/sql';
import { MollieOnboarding, MollieProfile, MollieStatus } from '@stamhoofd/structures';
import { IncomingMessage } from 'http';
import https from 'https';

import { Organization } from './Organization';

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class MollieToken extends QueryableModel {
    static table = 'mollie_tokens';

    @column({ primary: true, type: 'string' })
    organizationId!: string;

    @column({ type: 'string' })
    accessToken: string;

    @column({ type: 'string' })
    refreshToken: string;

    @column({ type: 'datetime' })
    expiresOn: Date;

    @column({
        type: 'datetime', beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    static verbose = true;

    static knownTokens: Map<string, MollieToken> = new Map();

    static async getTokenFor(organizationId: string) {
        const existing = this.knownTokens.get(organizationId);
        if (existing) {
            return existing;
        }
        const tokens = await MollieToken.where({ organizationId });
        if (tokens.length == 0) {
            return undefined;
        }
        this.knownTokens.set(organizationId, tokens[0]);
        return tokens[0];
    }

    async delete() {
        await super.delete();
        MollieToken.knownTokens.delete(this.organizationId);
    }

    private static objectToQueryString(obj: Record<string, string>) {
        const str: string[] = [];

        for (const p in obj)
            // eslint-disable-next-line no-prototype-builtins
            if (obj.hasOwnProperty(p)) {
                str.push(encodeURIComponent(p) + '=' + encodeURIComponent(obj[p]));
            }
        return str.join('&');
    }

    async getAccessToken() {
        if (this.expiresOn < new Date()) {
            await this.refresh();
            await sleep(200);
        }
        return this.accessToken;
    }

    async refreshIfNeeded() {
        if (this.expiresOn < new Date()) {
            await this.refresh();
            await sleep(200);
        }
    }

    async authRequest(method: string, path: string, data: PlainObject = {}) {
        if (this.expiresOn < new Date()) {
            await this.refresh();
            await sleep(200);
        }

        return await MollieToken.request(method, path, data, 'json', this.accessToken);
    }

    /**
     * Do a post request on the API.
     */
    private static request(method: string, path: string, data: PlainObject = {}, type = 'json', auth: string | null = null): Promise<any> {
        return new Promise((resolve, reject) => {
            let jsonData: string;
            if (type == 'json') {
                jsonData = JSON.stringify(data);
            }
            else {
                jsonData = this.objectToQueryString(data as Record<string, string>);
            }

            if (this.verbose) {
                console.log(method + ' https://api.mollie.com' + path + '\n' + jsonData);
            }
            const req = https.request(
                {
                    hostname: 'api.mollie.com',
                    path: path,
                    method: method,
                    headers: method === 'GET'
                        ? {
                                Authorization: auth ? 'Bearer ' + auth : 'Basic ' + Buffer.from((STAMHOOFD.MOLLIE_CLIENT_ID ?? '') + ':' + (STAMHOOFD.MOLLIE_SECRET ?? ''), 'ascii').toString('base64'),
                            }
                        : {
                                'Content-Type': type == 'json' ? 'application/json' : 'application/x-www-form-urlencoded',
                                'Content-Length': Buffer.byteLength(jsonData),
                                'Authorization': auth ? 'Bearer ' + auth : 'Basic ' + Buffer.from((STAMHOOFD.MOLLIE_CLIENT_ID ?? '') + ':' + (STAMHOOFD.MOLLIE_SECRET ?? ''), 'ascii').toString('base64'),
                            },
                    timeout: 10000,
                },
                (response: IncomingMessage) => {
                    if (this.verbose) {
                        console.log(`statusCode: ${response.statusCode ?? '/'}`);
                        console.log(`HEADERS: ${JSON.stringify(response.headers)}`);
                    }

                    const chunks: any[] = [];

                    response.on('data', (chunk) => {
                        chunks.push(chunk);
                    });

                    response.on('end', () => {
                        try {
                            if (!response.statusCode) {
                                reject(new Error('Unexpected order of events'));
                                return;
                            }
                            const body = Buffer.concat(chunks).toString();

                            if (this.verbose) {
                                console.log(body);
                            }

                            if (response.statusCode == 204) {
                                resolve(undefined);
                                return;
                            }

                            let json: any;
                            try {
                                json = JSON.parse(body);
                            }
                            catch (error) {
                                console.error(error);

                                // invalid json
                                if (response.statusCode < 200 || response.statusCode >= 300) {
                                    if (body.length == 0) {
                                        console.error(response.statusCode);
                                        reject(new Error('Status ' + response.statusCode));
                                        return;
                                    }
                                    console.error(response.statusCode + ' ' + body);
                                    reject(new Error(body));
                                    return;
                                }
                                else {
                                    // something wrong: throw parse error
                                    reject(error);
                                    return;
                                }
                            }

                            if (response.statusCode < 200 || response.statusCode >= 300) {
                                console.error(body);
                                reject(new Error(response.statusCode + ' ' + response.statusMessage));
                                return;
                            }

                            resolve(json);
                        }
                        catch (error) {
                            if (this.verbose) {
                                console.error(error);
                            }
                            reject(error);
                        }
                    });
                },
            );

            // use its "timeout" event to abort the request
            req.on('timeout', () => {
                req.abort();
            });

            req.on('error', (error) => {
                if (this.verbose) {
                    console.error(error);
                }
                reject(error);
            });

            if (method !== 'GET') {
                req.write(jsonData);
            }
            req.end();
        });
    }

    /**
    * Refresh the token itself, without generating a new token. Everyone who had the token has a new token now
    */
    async refresh(): Promise<void> {
        const data = await MollieToken.request('POST', '/oauth2/tokens', {
            grant_type: 'refresh_token',
            refresh_token: this.refreshToken,
        }, 'urlencoded');

        if (data && data.access_token && data.refresh_token) {
            // Delete token if exisitng
            this.refreshToken = data.refresh_token;
            this.accessToken = data.access_token;
            this.expiresOn = new Date(new Date().getTime() + 3600 * 1000 - 60 * 1000);
            await this.save();

            // Update shared tokens if this object was fetched directly
            MollieToken.knownTokens.set(this.organizationId, this);
            return;
        }
        throw new SimpleError({ code: '', message: 'Something went wrong in the response' });
    }

    /**
    * Refresh the token itself, without generating a new token. Everyone who had the token has a new token now
    */
    async revoke(): Promise<void> {
        try {
            await MollieToken.request('DELETE', '/oauth2/tokens', {
                token_type_hint: 'refresh_token',
                token: this.refreshToken,
            }, 'urlencoded');
        }
        catch (e) {
            console.error('Failed to revoke token', this.organizationId, e);
        }
        await this.delete();
    }

    /**
    * Refresh the token itself, without generating a new token. Everyone who had the token has a new token now
    */
    static async create(organization: Organization, code: string): Promise<MollieToken> {
        const data = await MollieToken.request('POST', '/oauth2/tokens', {
            grant_type: 'authorization_code',
            code: code,
        }, 'urlencoded');

        if (data && data.access_token && data.refresh_token) {
            // Delete token if exisitng
            const existing = await MollieToken.where({ organizationId: organization.id });
            const token = existing[0] ?? new MollieToken();
            token.organizationId = organization.id;
            token.refreshToken = data.refresh_token;
            token.accessToken = data.access_token;
            token.expiresOn = new Date(new Date().getTime() + 3600 * 1000 - 60 * 1000);
            await token.save();

            this.knownTokens.set(organization.id, token);

            organization.privateMeta.mollieOnboarding = await token.getOnboardingStatus();
            await token.setup(organization);

            await organization.save();
            return token;
        }
        throw new SimpleError({ code: '', message: 'Something went wrong in the response' });
    }

    async getOnboardingStatus() {
        try {
            const response = await this.authRequest('GET', '/v2/onboarding/me');
            return MollieOnboarding.create({
                canReceivePayments: !!response.canReceivePayments,
                canReceiveSettlements: !!response.canReceiveSettlements,
                status: response.status === 'needs-data' ? MollieStatus.NeedsData : (response.status === 'in-review' ? MollieStatus.InReview : (MollieStatus.Completed)),
            });
        }
        catch (e) {
            console.error('Error when requesting Mollie onboarding status:');
            console.error(e);
            return null;
        }
    }

    async getProfiles(): Promise<MollieProfile[]> {
        try {
            const response = await this.authRequest('GET', '/v2/profiles?limit=250');
            const profiles = response._embedded.profiles as PartialWithoutMethods<MollieProfile>[];
            return profiles.map(p => MollieProfile.create(p));
        }
        catch (e) {
            console.error('Failed to parse mollie profiles', e);
            return [];
        }
    }

    async getProfileId(website?: string): Promise<string | null> {
        const response = await this.authRequest('GET', '/v2/profiles?limit=250');
        const profiles = response._embedded.profiles;

        // Search profile with Stamhoofd as name
        if (website) {
            for (const profile of profiles) {
                if (profile.website.toLowerCase().includes(website)) {
                    return profile.id;
                }
            }
        }

        // Search profile with Stamhoofd as name
        for (const profile of profiles) {
            if (profile.name.toLowerCase().includes('stamhoofd')) {
                return profile.id;
            }
        }

        return response._embedded.profiles[0]?.id ?? null;
    }

    async getOnboardingLink() {
        const response = await this.authRequest('GET', '/v2/onboarding/me');
        return response._links.dashboard.href ?? '';
    }

    /**
     * Set initial onboarding values + enable bancontact
     */
    async setup(organization: Organization) {
        // Submit onboarding data

        if (organization.privateMeta.mollieOnboarding && organization.privateMeta.mollieOnboarding.status == MollieStatus.NeedsData) {
            await this.authRequest('POST', '/v2/onboarding/me', {
                organization: {
                    name: organization.name,
                    address: {
                        streetAndNumber: organization.address.street + ' ' + organization.address.number,
                        postalCode: organization.address.postalCode,
                        city: organization.address.city,
                        country: organization.address.country,
                    },

                    vatRegulation: 'shifted',
                },
                profile: {
                    name: organization.name + ' - Stamhoofd',
                    // url: "https://"+organization.getHost(),
                    description: $t(`62246c37-15c7-4f7d-94e2-7476f971c8da`),
                    categoryCode: 8398,
                },
            });
        }
    }
}
