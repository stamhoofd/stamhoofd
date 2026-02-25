/* eslint-disable jest/no-conditional-expect */
import { Request } from '@simonbackx/simple-endpoints';
import { Organization, OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';

import { PatchMap } from '@simonbackx/simple-encoding';
import { ApiUser, ApiUserRateLimits, PermissionLevel, Permissions, PermissionsResourceType, ResourcePermissions, UserMeta, UserPermissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { CreateApiUserEndpoint } from '../../src/endpoints/organization/dashboard/users/CreateApiUserEndpoint.js';
import { testServer } from '../helpers/TestServer.js';
import { GetUserEndpoint } from '../../src/endpoints/auth/GetUserEndpoint.js';

describe('E2E.APIRateLimits', () => {
    // Test endpoint
    const createEndpoint = new CreateApiUserEndpoint();
    const getUserEndpoint = new GetUserEndpoint();
    let organization: Organization;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        organization = await new OrganizationFactory({}).create();
    });

    /**
     * Note: we don't use a factory because this is an E2E test and
     * we also want to check if the created tokens with the API are actually marked as API-keys and not normal users.
     */
    async function createAPIToken(rateLimits: ApiUserRateLimits | null) {
        const user = await new UserFactory({
            globalPermissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();
        const token = await Token.createToken(user);

        const createRequest = Request.buildJson('POST', '/api-keys', organization.getApiHost(), ApiUser.create({
            permissions: UserPermissions.create({
                organizationPermissions: new Map([
                    [organization.id, Permissions.create({ level: PermissionLevel.Read })],
                ]),
            }),
            meta: UserMeta.create({
                rateLimits,
            }),
        }));
        createRequest.headers.authorization = 'Bearer ' + token.accessToken;
        const createResponse = await testServer.test(createEndpoint, createRequest);

        expect(createResponse.body.meta?.rateLimits ?? undefined).toEqual(rateLimits ?? undefined);

        return createResponse.body.token;
    }

    test('By default throws after 25 requests in less than 5s', async () => {
        const token = await createAPIToken(null);

        // Start firing
        for (let i = 0; i < 30; i++) {
            const request = Request.buildJson('GET', '/user', organization.getApiHost());
            request.headers.authorization = 'Bearer ' + token;
            const promise = testServer.test(getUserEndpoint, request);

            if (i < 25) {
                try {
                    await expect(promise).toResolve();
                }
                catch (e) {
                    let error: any = null;
                    try {
                        await promise;
                    }
                    catch (e) {
                        error = e;
                    }
                    throw new Error('The endpoint rejected at call ' + i + ' with error message ' + error?.message);
                }
            }
            else {
                await expect(promise).rejects.toThrow(
                    STExpect.simpleError({
                        code: 'rate_limit',
                    }),
                );
            }
        }
    });

    test('Normal rate limit throws after 25 requests in less than 5s', async () => {
        const token = await createAPIToken(ApiUserRateLimits.Normal);

        // Start firing
        for (let i = 0; i < 30; i++) {
            const request = Request.buildJson('GET', '/user', organization.getApiHost());
            request.headers.authorization = 'Bearer ' + token;
            const promise = testServer.test(getUserEndpoint, request);

            if (i < 25) {
                try {
                    await expect(promise).toResolve();
                }
                catch (e) {
                    let error: any = null;
                    try {
                        await promise;
                    }
                    catch (e) {
                        error = e;
                    }
                    throw new Error('The endpoint rejected at call ' + i + ' with error message ' + error?.message);
                }
            }
            else {
                await expect(promise).rejects.toThrow(
                    STExpect.simpleError({
                        code: 'rate_limit',
                    }),
                );
            }
        }
    });

    test('Medium rate limits throw after 50 requests in less than 5s', async () => {
        const token = await createAPIToken(ApiUserRateLimits.Medium);

        // Start firing
        for (let i = 0; i < 60; i++) {
            const request = Request.buildJson('GET', '/user', organization.getApiHost());
            request.headers.authorization = 'Bearer ' + token;
            const promise = testServer.test(getUserEndpoint, request);

            if (i < 50) {
                try {
                    await expect(promise).toResolve();
                }
                catch (e) {
                    let error: any = null;
                    try {
                        await promise;
                    }
                    catch (e) {
                        error = e;
                    }
                    throw new Error('The endpoint rejected at call ' + i + ' with error message ' + error?.message);
                }
            }
            else {
                await expect(promise).rejects.toThrow(
                    STExpect.simpleError({
                        code: 'rate_limit',
                    }),
                );
            }
        }
    });

    test('High rate limits throw after 125 requests in less than 5s', async () => {
        const token = await createAPIToken(ApiUserRateLimits.High);

        // Start firing
        for (let i = 0; i < 140; i++) {
            const request = Request.buildJson('GET', '/user', organization.getApiHost());
            request.headers.authorization = 'Bearer ' + token;
            const promise = testServer.test(getUserEndpoint, request);

            if (i < 125) {
                try {
                    await expect(promise).toResolve();
                }
                catch (e) {
                    let error: any = null;
                    try {
                        await promise;
                    }
                    catch (e) {
                        error = e;
                    }
                    throw new Error('The endpoint rejected at call ' + i + ' with error message ' + error?.message);
                }
            }
            else {
                await expect(promise).rejects.toThrow(
                    STExpect.simpleError({
                        code: 'rate_limit',
                    }),
                );
            }
        }
    });
});
