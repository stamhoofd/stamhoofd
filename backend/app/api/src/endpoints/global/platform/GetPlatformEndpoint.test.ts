import { Request } from '@simonbackx/simple-endpoints';
import { Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions, Version } from '@stamhoofd/structures';

import { TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { GetPlatformEndpoint } from './GetPlatformEndpoint.js';

describe('Endpoint.GetPlatformEndpoint', () => {
    const endpoint = new GetPlatformEndpoint();

    const getPlatform = async (token?: Token) => {
        const request = Request.buildJson('GET', `/v${Version}/platform`);
        if (token) {
            request.headers.authorization = 'Bearer ' + token.accessToken;
        }
        return await testServer.test(endpoint, request);
    };

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    test('Should return platform without private config if not authenticated', async () => {
        const platform = await getPlatform();
        expect(platform.body.privateConfig).toBeNull();
    });

    test('Should return platform without private config if no platform access', async () => {
        const user = await new UserFactory({
            globalPermissions: Permissions.create({
                level: PermissionLevel.None,
            }),
        })
            .create();

        const token = await Token.createToken(user);
        const platform = await getPlatform(token);
        expect(platform.body.privateConfig).toBeNull();
    });

    test('Should return platform with private config if authenticated and has platform access', async () => {
        const user = await new UserFactory({
            globalPermissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        })
            .create();

        const token = await Token.createToken(user);
        const platform = await getPlatform(token);
        expect(platform.body.privateConfig).not.toBeNull();
    });

    test('Should throw if invalid token', async () => {
        const user = await new UserFactory({
            globalPermissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        })
            .create();

        const token = await Token.createToken(user);
        token.accessToken = 'invalid-token';
        await token.save();
        await expect(getPlatform(token)).rejects.toThrow('The access token is invalid');
    });
});
