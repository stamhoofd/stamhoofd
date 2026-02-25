import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { PatchApiUserEndpoint } from './PatchApiUserEndpoint.js';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { ApiUser, ApiUserRateLimits, PermissionLevel, Permissions, UserMeta, UserPermissions } from '@stamhoofd/structures';
import { CreateApiUserEndpoint } from './CreateApiUserEndpoint.js';

describe('Endpoint.CreateApiUserEndpoint', () => {
    // Test endpoint
    const endpoint = new CreateApiUserEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    test('Only a platform admin can set the rate limits of a key', async () => {
        const organization = await new OrganizationFactory({}).create();
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
                rateLimits: ApiUserRateLimits.High,
            }),
        }));
        createRequest.headers.authorization = 'Bearer ' + token.accessToken;
        const response = await testServer.test(endpoint, createRequest);

        expect(response.body).toBeDefined();
        expect(response.body.meta?.rateLimits).toEqual(ApiUserRateLimits.High);
    });

    test('An organization admin cannot set rate limits', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
            organization,
        }).create();
        const token = await Token.createToken(user);

        const createRequest = Request.buildJson('POST', '/api-keys', organization.getApiHost(), ApiUser.create({
            permissions: UserPermissions.create({
                organizationPermissions: new Map([
                    [organization.id, Permissions.create({ level: PermissionLevel.Read })],
                ]),
            }),
            meta: UserMeta.create({
                rateLimits: ApiUserRateLimits.High,
            }),
        }));
        createRequest.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(endpoint, createRequest)).rejects.toThrow(STExpect.simpleError({
            code: 'permission_denied',
        }));
    });

    test('An API-key cannot have permissions outside its organization', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
            organization,
        }).create();
        const token = await Token.createToken(user);

        const createRequest = Request.buildJson('POST', '/api-keys', organization.getApiHost(), ApiUser.create({
            permissions: UserPermissions.create({
                organizationPermissions: new Map([
                    [organization.id, Permissions.create({ level: PermissionLevel.Read })],
                    ['other', Permissions.create({ level: PermissionLevel.Full })],
                ]),
                globalPermissions: Permissions.create({
                    level: PermissionLevel.Full,
                }),
            }),
        }));
        createRequest.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, createRequest);

        expect(response.body).toBeDefined();
        expect(response.body.permissions).toEqual(
            UserPermissions.create({
                organizationPermissions: new Map([
                    [organization.id, Permissions.create({ level: PermissionLevel.Read })],
                ]),
                globalPermissions: null,
            }),
        );
    });
});
