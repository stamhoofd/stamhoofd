import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { Database } from '@simonbackx/simple-database';
import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, User, Webshop } from '@stamhoofd/models';
import type { Token } from '@stamhoofd/models';
import { OrganizationFactory, UserFactory, WebshopDiscountCode, WebshopFactory } from '@stamhoofd/models';
import { CountFilteredRequest, DiscountCode, LimitedFilteredRequest, PermissionLevel, Permissions, PrivateDiscountCode, SortItemDirection } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { v4 as uuidv4 } from 'uuid';

import { SessionService } from '../../../../services/SessionService.js';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { GetWebshopDiscountCodesCountEndpoint } from './GetDiscountCodesCountEndpoint.js';
import { GetWebshopDiscountCodesEndpoint } from './GetDiscountCodesEndpoint.js';
import { PatchWebshopDiscountCodesEndpoint } from './PatchDiscountCodesEndpoint.js';

/** Mutate the encoded PUT so the invalid value bypasses the client-side decoder. */
function setEmailOnEncodedCode(encoded: unknown, code: string, email: string) {
    if (Array.isArray(encoded)) {
        encoded.forEach(item => setEmailOnEncodedCode(item, code, email));
        return;
    }
    if (encoded && typeof encoded === 'object') {
        const record = encoded as Record<string, unknown>;
        if (record.code === code) {
            record.email = email;
            return;
        }
        Object.values(record).forEach(value => setEmailOnEncodedCode(value, code, email));
    }
}

const getEndpoint = new GetWebshopDiscountCodesEndpoint();
const countEndpoint = new GetWebshopDiscountCodesCountEndpoint();
const patchEndpoint = new PatchWebshopDiscountCodesEndpoint();

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
        token = await SessionService.createSession(user);
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

    function get(query: LimitedFilteredRequest, options: { webshopId?: string; accessToken?: string } = {}) {
        return testServer.test(getEndpoint, Request.get({
            path: `/webshop/${options.webshopId ?? webshop.id}/discount-codes`,
            host: organization.getApiHost(),
            query,
            headers: {
                authorization: 'Bearer ' + (options.accessToken ?? token.accessToken),
            },
        }));
    }

    function count(query: CountFilteredRequest, options: { accessToken?: string } = {}) {
        return testServer.test(countEndpoint, Request.get({
            path: `/webshop/${webshop.id}/discount-codes/count`,
            host: organization.getApiHost(),
            query,
            headers: {
                authorization: 'Bearer ' + (options.accessToken ?? token.accessToken),
            },
        }));
    }

    function patch(body: PatchableArrayAutoEncoder<PrivateDiscountCode>) {
        const request = Request.buildJson('PATCH', `/webshop/${webshop.id}/discount-codes`, organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return testServer.test(patchEndpoint, request);
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
        await createDiscountCode({
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

        const firstPage = await get(new LimitedFilteredRequest({
            limit: 2,
            sort: [{ key: 'code', order: SortItemDirection.ASC }],
        }));
        expect(firstPage.body.results.map((code: DiscountCode) => code.code)).toEqual(['ALPHA', 'BETA']);
        expect(firstPage.body.next).toBeDefined();

        const secondPage = await get(firstPage.body.next!);
        expect(secondPage.body.results.map((code: DiscountCode) => code.code)).toEqual(['GAMMA']);

        const emailFilterResponse = await get(new LimitedFilteredRequest({
            filter: {
                email: {
                    $in: ['alpha@example.com', 'beta@example.com'],
                },
            },
            limit: 10,
            sort: [{ key: 'code', order: SortItemDirection.ASC }],
        }));
        expect(emailFilterResponse.body.results.map((code: DiscountCode) => code.id)).toEqual([alpha.id, beta.id]);

        const searchResponse = await get(new LimitedFilteredRequest({
            search: 'sponsor',
            limit: 10,
        }));
        expect(searchResponse.body.results.map((code: DiscountCode) => code.id)).toEqual([alpha.id]);

        const countResponse = await count(new CountFilteredRequest({
            filter: {
                usageCount: 3,
            },
        }));
        expect(countResponse.body.count).toBe(2);
    });

    test('pages without gaps or duplicates when sorted by email with codes without an email', async () => {
        const codes = ['A', 'B', 'C', 'D', 'E'];
        for (const [index, code] of codes.entries()) {
            await createDiscountCode({
                code,
                email: index % 2 === 0 ? null : `${code.toLowerCase()}@example.com`,
            });
        }

        for (const order of [SortItemDirection.ASC, SortItemDirection.DESC]) {
            const seen: string[] = [];
            let next: LimitedFilteredRequest | undefined = new LimitedFilteredRequest({
                limit: 2,
                sort: [{ key: 'email', order }],
            });

            while (next) {
                const page = await get(next);
                seen.push(...page.body.results.map((code: DiscountCode) => code.code));
                next = page.body.next;
            }

            expect([...seen].sort()).toEqual(codes);
        }
    });

    test('does not return codes of a webshop of another organization', async () => {
        const otherOrganization = await new OrganizationFactory({}).create();
        const otherWebshop = await new WebshopFactory({ organizationId: otherOrganization.id }).create();
        await createDiscountCode({
            organizationId: otherOrganization.id,
            webshopId: otherWebshop.id,
            code: 'OTHER',
        });

        await expect(get(new LimitedFilteredRequest({ limit: 10 }), { webshopId: otherWebshop.id }))
            .rejects
            .toThrow(STExpect.errorWithCode('not_found'));
    });

    test('rejects a page size above the limit', async () => {
        await expect(get(new LimitedFilteredRequest({ limit: 101 })))
            .rejects
            .toThrow(STExpect.errorWithCode('invalid_field'));
    });

    test('refuses a batch with a duplicate code before writing anything', async () => {
        await createDiscountCode({ code: 'EXISTING' });

        const withinBatch: PatchableArrayAutoEncoder<PrivateDiscountCode> = new PatchableArray();
        withinBatch.addPut(PrivateDiscountCode.create({ code: 'NEW-1' }));
        withinBatch.addPut(PrivateDiscountCode.create({ code: 'NEW-2' }));
        withinBatch.addPut(PrivateDiscountCode.create({ code: 'NEW-1' }));
        await expect(patch(withinBatch)).rejects.toThrow(STExpect.errorWithCode('used_code'));

        const againstExisting: PatchableArrayAutoEncoder<PrivateDiscountCode> = new PatchableArray();
        againstExisting.addPut(PrivateDiscountCode.create({ code: 'NEW-3' }));
        againstExisting.addPut(PrivateDiscountCode.create({ code: 'EXISTING' }));
        await expect(patch(againstExisting)).rejects.toThrow(STExpect.errorWithCode('used_code'));

        const codes = await WebshopDiscountCode.where({ webshopId: webshop.id });
        expect(codes.map(code => code.code)).toEqual(['EXISTING']);
    });

    test('requires full access to the webshop', async () => {
        await createDiscountCode({ code: 'ALPHA' });

        const readOnlyUser = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Read,
            }),
        }).create();
        const readOnlyToken = await SessionService.createSession(readOnlyUser);

        await expect(get(new LimitedFilteredRequest({ limit: 10 }), { accessToken: readOnlyToken.accessToken }))
            .rejects
            .toThrow(STExpect.errorWithCode('not_found'));

        await expect(count(new CountFilteredRequest({}), { accessToken: readOnlyToken.accessToken }))
            .rejects
            .toThrow(STExpect.errorWithCode('not_found'));
    });

    test('stores the email of a discount code and rejects invalid email addresses', async () => {
        const putBody: PatchableArrayAutoEncoder<PrivateDiscountCode> = new PatchableArray();
        putBody.addPut(PrivateDiscountCode.create({
            code: 'WITH-EMAIL',
            email: 'sponsor@example.com',
        }));
        const putResponse = await patch(putBody);
        expect(putResponse.body[0].email).toBe('sponsor@example.com');

        const created = await WebshopDiscountCode.getByID(putResponse.body[0].id);
        expect(created?.email).toBe('sponsor@example.com');

        const clearBody: PatchableArrayAutoEncoder<PrivateDiscountCode> = new PatchableArray();
        clearBody.addPatch(PrivateDiscountCode.patch({
            id: putResponse.body[0].id,
            email: null,
        }));
        const clearResponse = await patch(clearBody);
        expect(clearResponse.body[0].email).toBeNull();

        const invalidBody: PatchableArrayAutoEncoder<PrivateDiscountCode> = new PatchableArray();
        invalidBody.addPut(PrivateDiscountCode.create({
            code: 'INVALID-EMAIL',
        }));
        const encoded = invalidBody.encode({ version: 1000 });
        setEmailOnEncodedCode(encoded, 'INVALID-EMAIL', 'not-an-email');
        const invalidRequest = Request.buildJson('PATCH', `/webshop/${webshop.id}/discount-codes`, organization.getApiHost(), encoded);
        invalidRequest.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(patchEndpoint, invalidRequest))
            .rejects
            .toThrow(STExpect.errorWithCode('invalid_field'));
    });

    test('rejects PUTs that would push a webshop past the discount code cap, while allowing patches', async () => {
        await createManyDiscountCodes(DiscountCode.maxPerWebshop);
        const existing = (await WebshopDiscountCode.where({ webshopId: webshop.id }))[0];

        const patchOnlyBody: PatchableArrayAutoEncoder<PrivateDiscountCode> = new PatchableArray();
        patchOnlyBody.addPatch(PrivateDiscountCode.patch({
            id: existing.id,
            description: 'updated without increasing the count',
        }));

        const patchOnlyResponse = await patch(patchOnlyBody);
        expect(patchOnlyResponse.status).toBe(200);
        expect(patchOnlyResponse.body[0].description).toBe('updated without increasing the count');

        const putBody: PatchableArrayAutoEncoder<PrivateDiscountCode> = new PatchableArray();
        putBody.addPut(PrivateDiscountCode.create({
            id: uuidv4(),
            code: 'ONE-TOO-MANY',
        }));

        await expect(patch(putBody))
            .rejects
            .toThrow(STExpect.errorWithCode('too_many_discount_codes'));
    });
});
