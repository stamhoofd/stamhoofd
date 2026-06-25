import type { Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, AutoEncoder, field, IntegerDecoder, PatchableArray, StringDecoder } from '@simonbackx/simple-encoding';
import { Database } from '@simonbackx/simple-database';
import type { DecodedRequest, Request as EndpointRequest } from '@simonbackx/simple-endpoints';
import { Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import type { Organization, User, Webshop } from '@stamhoofd/models';
import { Email, OrganizationFactory, Token, UserFactory, WebshopDiscountCode, WebshopFactory } from '@stamhoofd/models';
import { CountFilteredRequest, DiscountCode, EmailRecipientFilterType, LimitedFilteredRequest, PermissionLevel, Permissions, SortItemDirection } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { v4 as uuidv4 } from 'uuid';

import '../../../../email-recipient-loaders/discount-codes.js';
import { Context } from '../../../../helpers/Context.js';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { GetWebshopDiscountCodesCountEndpoint } from './GetDiscountCodesCountEndpoint.js';
import { GetWebshopDiscountCodesEndpoint } from './GetDiscountCodesEndpoint.js';
import { PatchWebshopDiscountCodesEndpoint } from './PatchDiscountCodesEndpoint.js';

const getEndpoint = new GetWebshopDiscountCodesEndpoint();
const countEndpoint = new GetWebshopDiscountCodesCountEndpoint();
const patchEndpoint = new PatchWebshopDiscountCodesEndpoint();
type PatchBody = typeof patchEndpoint extends Endpoint<any, any, infer B, any> ? B : never;

class LoaderTestReplacement extends AutoEncoder {
    @field({ decoder: StringDecoder })
    token: string;

    @field({ decoder: StringDecoder })
    value: string;
}

class LoaderTestRecipient extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    email: string | null;

    @field({ decoder: StringDecoder, nullable: true })
    objectId: string | null;

    @field({ decoder: new ArrayDecoder(LoaderTestReplacement) })
    replacements: LoaderTestReplacement[] = [];
}

class LoaderTestResult extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    count: number;

    @field({ decoder: new ArrayDecoder(LoaderTestRecipient) })
    results: LoaderTestRecipient[] = [];
}

class DiscountCodeRecipientLoaderTestEndpoint extends Endpoint<Record<string, never>, LimitedFilteredRequest, undefined, LoaderTestResult> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: EndpointRequest): [true, Record<string, never>] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/discount-code-recipient-loader-test', {});
        if (params) {
            return [true, {}];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Record<string, never>, LimitedFilteredRequest, undefined>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error();
        }

        const loader = Email.recipientLoaders.get(EmailRecipientFilterType.WebshopDiscountCodes);
        if (!loader) {
            throw new Error('Discount code recipient loader was not registered');
        }

        const response = await loader.fetch(request.query, null);
        const count = await loader.count(request.query, null);

        return new Response(LoaderTestResult.create({
            count,
            results: response.results.map(recipient => ({
                email: recipient.email,
                objectId: recipient.objectId,
                replacements: recipient.replacements.map(replacement => ({
                    token: replacement.token,
                    value: replacement.value,
                })),
            })),
        }));
    }
}

const loaderEndpoint = new DiscountCodeRecipientLoaderTestEndpoint();

describe('Endpoint.WebshopDiscountCodes', () => {
    let organization: Organization;
    let user: User;
    let token: Token;
    let webshop: Webshop;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        await Database.delete('DELETE FROM `webshop_discount_codes`');

        organization = await new OrganizationFactory({}).create();
        user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();
        token = await Token.createToken(user);
        webshop = await new WebshopFactory({ organizationId: organization.id, name: 'Discount codes test webshop' }).create();
    });

    async function createDiscountCode(data: {
        webshopId?: string;
        organizationId?: string;
        code: string;
        description?: string;
        email?: string | null;
        usageCount?: number;
        maximumUsage?: number | null;
    }) {
        const model = new WebshopDiscountCode();
        model.organizationId = data.organizationId ?? organization.id;
        model.webshopId = data.webshopId ?? webshop.id;
        model.code = data.code;
        model.description = data.description ?? '';
        model.email = data.email ?? null;
        model.usageCount = data.usageCount ?? 0;
        model.maximumUsage = data.maximumUsage ?? null;
        await model.save();
        return model;
    }

    async function createManyDiscountCodes(amount: number) {
        const batchSize = 50;
        for (let start = 0; start < amount; start += batchSize) {
            await Promise.all(Array.from({ length: Math.min(batchSize, amount - start) }, (_, index) => createDiscountCode({
                code: 'CAP-' + String(start + index).padStart(4, '0'),
            })));
        }
    }

    function authHeaders() {
        return {
            authorization: 'Bearer ' + token.accessToken,
        };
    }

    test('gets paginated, filtered and counted discount codes scoped by the webshop URL', async () => {
        const alpha = await createDiscountCode({
            code: 'ALPHA',
            description: 'special sponsor code',
            email: 'alpha@example.com',
            usageCount: 1,
        });
        const beta = await createDiscountCode({
            code: 'BETA',
            email: 'beta@example.com',
            usageCount: 3,
        });
        const gamma = await createDiscountCode({
            code: 'GAMMA',
            email: null,
            usageCount: 3,
        });

        const otherWebshop = await new WebshopFactory({ organizationId: organization.id }).create();
        await createDiscountCode({
            webshopId: otherWebshop.id,
            code: 'OTHER',
            email: 'alpha@example.com',
            usageCount: 3,
        });

        const firstPageRequest = Request.get({
            path: `/webshop/${webshop.id}/discount-codes`,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                limit: 2,
                sort: [{ key: 'code', order: SortItemDirection.ASC }],
            }),
            headers: authHeaders(),
        });

        const firstPage = await testServer.test(getEndpoint, firstPageRequest);
        expect(firstPage.body.results.map((code: DiscountCode) => code.code)).toEqual(['ALPHA', 'BETA']);
        expect(firstPage.body.next).toBeDefined();

        const secondPageRequest = Request.get({
            path: `/webshop/${webshop.id}/discount-codes`,
            host: organization.getApiHost(),
            query: firstPage.body.next,
            headers: authHeaders(),
        });

        const secondPage = await testServer.test(getEndpoint, secondPageRequest);
        expect(secondPage.body.results.map((code: DiscountCode) => code.code)).toEqual(['GAMMA']);

        const emailFilterRequest = Request.get({
            path: `/webshop/${webshop.id}/discount-codes`,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                filter: {
                    email: {
                        $in: ['alpha@example.com', 'beta@example.com'],
                    },
                },
                limit: 10,
                sort: [{ key: 'code', order: SortItemDirection.ASC }],
            }),
            headers: authHeaders(),
        });
        const emailFilterResponse = await testServer.test(getEndpoint, emailFilterRequest);
        expect(emailFilterResponse.body.results.map((code: DiscountCode) => code.id)).toEqual([alpha.id, beta.id]);

        const searchRequest = Request.get({
            path: `/webshop/${webshop.id}/discount-codes`,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                search: 'sponsor',
                limit: 10,
            }),
            headers: authHeaders(),
        });
        const searchResponse = await testServer.test(getEndpoint, searchRequest);
        expect(searchResponse.body.results.map((code: DiscountCode) => code.id)).toEqual([alpha.id]);

        const countRequest = Request.get({
            path: `/webshop/${webshop.id}/discount-codes/count`,
            host: organization.getApiHost(),
            query: new CountFilteredRequest({
                filter: {
                    usageCount: 3,
                },
            }),
            headers: authHeaders(),
        });
        const countResponse = await testServer.test(countEndpoint, countRequest);
        expect(countResponse.body.count).toBe(2);
        expect([alpha.id, beta.id, gamma.id]).toHaveLength(3);
    });

    test('rejects PUTs that would push a webshop past the discount code cap, while allowing patches', async () => {
        await createManyDiscountCodes(1000);
        const existing = (await WebshopDiscountCode.where({ webshopId: webshop.id }))[0];

        const patchOnlyBody: PatchBody = new PatchableArray() as PatchableArrayAutoEncoder<DiscountCode>;
        patchOnlyBody.addPatch(DiscountCode.patch({
            id: existing.id,
            description: 'updated without increasing the count',
        }));

        const patchOnlyRequest = Request.buildJson('PATCH', `/webshop/${webshop.id}/discount-codes`, organization.getApiHost(), patchOnlyBody);
        patchOnlyRequest.headers.authorization = 'Bearer ' + token.accessToken;
        const patchOnlyResponse = await testServer.test(patchEndpoint, patchOnlyRequest);
        expect(patchOnlyResponse.status).toBe(200);
        expect(patchOnlyResponse.body[0].description).toBe('updated without increasing the count');

        const putBody: PatchBody = new PatchableArray() as PatchableArrayAutoEncoder<DiscountCode>;
        putBody.addPut(DiscountCode.create({
            id: uuidv4(),
            code: 'ONE-TOO-MANY',
        }));

        const putRequest = Request.buildJson('PATCH', `/webshop/${webshop.id}/discount-codes`, organization.getApiHost(), putBody);
        putRequest.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(patchEndpoint, putRequest))
            .rejects
            .toThrow(STExpect.errorWithCode('too_many_discount_codes'));
    });

    test('recipient loader returns only codes with email and includes code replacements', async () => {
        const alpha = await createDiscountCode({
            code: 'ALPHA',
            email: 'alpha@example.com',
        });
        await createDiscountCode({
            code: 'NO-EMAIL',
            email: null,
        });
        await createDiscountCode({
            code: 'EMPTY-EMAIL',
            email: '',
        });
        const beta = await createDiscountCode({
            code: 'BETA',
            email: 'beta@example.com',
        });

        const request = Request.get({
            path: '/discount-code-recipient-loader-test',
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                filter: {
                    webshopId: webshop.id,
                },
                limit: 10,
                sort: [{ key: 'code', order: SortItemDirection.ASC }],
            }),
            headers: authHeaders(),
        });

        const response = await testServer.test(loaderEndpoint, request);
        expect(response.body.count).toBe(2);
        expect(response.body.results.map((recipient: LoaderTestRecipient) => recipient.email)).toEqual(['alpha@example.com', 'beta@example.com']);

        const alphaRecipient = response.body.results.find((recipient: LoaderTestRecipient) => recipient.objectId === alpha.id)!;
        expect(alphaRecipient.replacements).toEqual(expect.arrayContaining([
            expect.objectContaining({ token: 'discountCode', value: 'ALPHA' }),
            expect.objectContaining({ token: 'discountUrl', value: expect.stringContaining('/code/ALPHA') }),
        ]));

        const betaRecipient = response.body.results.find((recipient: LoaderTestRecipient) => recipient.objectId === beta.id)!;
        expect(betaRecipient.replacements).toEqual(expect.arrayContaining([
            expect.objectContaining({ token: 'discountCode', value: 'BETA' }),
            expect.objectContaining({ token: 'discountUrl', value: expect.stringContaining('/code/BETA') }),
        ]));
    });
});
