import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { PatchApiUserEndpoint } from './PatchApiUserEndpoint.js';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { ApiUser, ApiUserRateLimits, PermissionLevel, Permissions, PermissionsResourceType, ResourcePermissions, UserMeta, UserPermissions } from '@stamhoofd/structures';
import { CreateApiUserEndpoint } from './CreateApiUserEndpoint.js';
import { PatchMap } from '@simonbackx/simple-encoding';

describe('Endpoint.PatchApiUserEndpoint', () => {
    // Test endpoint
    const createEndpoint = new CreateApiUserEndpoint();
    const endpoint = new PatchApiUserEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    test('Only a platform admin can alter the rate limits of a key', async () => {
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
        }));
        createRequest.headers.authorization = 'Bearer ' + token.accessToken;
        const createResponse = await testServer.test(createEndpoint, createRequest);

        const apiUserId = createResponse.body.id;

        const r = Request.buildJson('PATCH', '/api-keys/' + apiUserId, organization.getApiHost(), ApiUser.patch({
            id: apiUserId,
            meta: UserMeta.patch({
                rateLimits: ApiUserRateLimits.High,
            }),
        }));
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();
        expect(response.body.id).toEqual(apiUserId);
        expect(response.body.meta?.rateLimits).toEqual(ApiUserRateLimits.High);
    });

    test('An organization admin cannot alter rate limits', async () => {
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
        }));
        createRequest.headers.authorization = 'Bearer ' + token.accessToken;
        const createResponse = await testServer.test(createEndpoint, createRequest);

        const apiUserId = createResponse.body.id;

        const r = Request.buildJson('PATCH', '/api-keys/' + apiUserId, organization.getApiHost(), ApiUser.patch({
            id: apiUserId,
            meta: UserMeta.patch({
                rateLimits: ApiUserRateLimits.High,
            }),
        }));
        r.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(endpoint, r)).rejects.toThrow(STExpect.simpleError({
            code: 'permission_denied',
        }));
    });

    test('You cannot grant an API-key permissions outside its organization using a put', async () => {
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
        }));
        createRequest.headers.authorization = 'Bearer ' + token.accessToken;
        const createResponse = await testServer.test(createEndpoint, createRequest);
        const apiUserId = createResponse.body.id;

        const r = Request.buildJson('PATCH', '/api-keys/' + apiUserId, organization.getApiHost(), ApiUser.patch({
            id: apiUserId,
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
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();
        expect(response.body.id).toEqual(apiUserId);
        expect(response.body.permissions).toEqual(
            UserPermissions.create({
                organizationPermissions: new Map([
                    [organization.id, Permissions.create({ level: PermissionLevel.Read })],
                ]),
                globalPermissions: null,
            }),
        );
    });

    test('You cannot grant an API-key permissions outside its organization using a patch', async () => {
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
        }));
        createRequest.headers.authorization = 'Bearer ' + token.accessToken;
        const createResponse = await testServer.test(createEndpoint, createRequest);
        const apiUserId = createResponse.body.id;

        const r = Request.buildJson('PATCH', '/api-keys/' + apiUserId, organization.getApiHost(), ApiUser.patch({
            id: apiUserId,
            permissions: UserPermissions.patch({
                organizationPermissions: new PatchMap([
                    ['other', Permissions.create({ level: PermissionLevel.Full })],
                ]),
                globalPermissions: Permissions.create({
                    level: PermissionLevel.Full,
                }),
            }),
        }));
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();
        expect(response.body.id).toEqual(apiUserId);
        expect(response.body.permissions).toEqual(
            UserPermissions.create({
                organizationPermissions: new Map([
                    [organization.id, Permissions.create({ level: PermissionLevel.Read })],
                ]),
                globalPermissions: null,
            }),
        );
    });

    test('You can grant an API-key permissions using a patch', async () => {
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
        }));
        createRequest.headers.authorization = 'Bearer ' + token.accessToken;
        const createResponse = await testServer.test(createEndpoint, createRequest);
        const apiUserId = createResponse.body.id;

        const r = Request.buildJson('PATCH', '/api-keys/' + apiUserId, organization.getApiHost(), ApiUser.patch({
            id: apiUserId,
            permissions: UserPermissions.patch({
                organizationPermissions: new PatchMap([
                    [organization.id, Permissions.patch({
                        resources: new PatchMap([[
                            PermissionsResourceType.Groups,
                            new Map([
                                ['group-id', ResourcePermissions.create({
                                    level: PermissionLevel.Full,
                                })],
                            ]),
                        ]]),
                    })],
                ]),
            }),
        }));
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();
        expect(response.body.id).toEqual(apiUserId);
        expect(response.body.permissions).toEqual(
            UserPermissions.create({
                organizationPermissions: new Map([
                    [organization.id, Permissions.create({
                        level: PermissionLevel.Read,
                        resources: new Map([[
                            PermissionsResourceType.Groups,
                            new Map([
                                ['group-id', ResourcePermissions.create({
                                    level: PermissionLevel.Full,
                                })],
                            ]),
                        ]]),
                    })],
                ]),
                globalPermissions: null,
            }),
        );
    });
});
