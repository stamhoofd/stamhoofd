import { Database } from '@simonbackx/simple-database';
import { SessionClientType, SessionDeviceType, SessionLoginMethod } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

import { OrganizationFactory } from '../factories/OrganizationFactory.js';
import { UserFactory } from '../factories/UserFactory.js';
import type { Organization } from './Organization.js';
import { Token } from './Token.js';
import type { User } from './User.js';
import { UserSession } from './UserSession.js';

describe('Model.Token', () => {
    const existingToken = 'ABCDEFG';
    let user: User;
    let organization: Organization;

    beforeAll(async () => {
        organization = await new OrganizationFactory({}).create();
        user = await new UserFactory({ organization }).create();
        const tokenId = uuidv4();
        const session = await UserSession.createForToken(user, tokenId, SessionClientType.Browser, SessionLoginMethod.Password, {
            deviceType: SessionDeviceType.Desktop,
            deviceName: null,
            osName: null,
            osVersion: null,
            appVersion: null,
            nativeAppVersion: null,
            browserName: null,
        });

        await Database.insert('INSERT INTO ' + Token.table + ' SET ?', [
            {
                id: tokenId,
                sessionId: session.id,
                accessToken: existingToken,
                refreshToken: 'refreshtoken',

                accessTokenValidUntil: '2050-08-29 14:30:15',
                refreshTokenValidUntil: '2050-08-29 14:30:15',
                userId: user.id,
                // = "myPassword"
                createdAt: '2020-03-29 14:30:15',
                updatedAt: '2020-03-29 14:30:15',
            },
        ]);
    });

    test('Get token', async () => {
        const token: any = await Token.getByAccessToken(existingToken);
        expect(token).toBeDefined();
        expect(token).toBeInstanceOf(Token);
        expect(token.user.id).toEqual(user.id);
        expect(token.accessToken).toEqual(existingToken);
        expect(token.userId).toEqual(user.id);
    });

    test('Create a token', async () => {
        const token = await Token.createToken(user);
        expect(token).toBeDefined();
        if (!token) return;
        expect(token).toBeInstanceOf(Token);
        expect(token.user.id).toEqual(user.id);
        expect(token.accessToken).toHaveLength(256);
        expect(token.refreshToken).toHaveLength(256);
        expect(token.accessTokenValidUntil.getTime()).toBeGreaterThan(new Date().getTime() + 14 * 60 * 1000);
        expect(token.accessTokenValidUntil.getTime()).toBeLessThanOrEqual(new Date().getTime() + 15 * 60 * 1000);

        expect(token.refreshTokenValidUntil.getTime()).toBeGreaterThan(token.accessTokenValidUntil.getTime());
        expect(token.refreshTokenValidUntil.getTime()).toBeLessThan(new Date().getTime() + 3600 * 1000 * 24 * 365);

        expect(token.userId).toEqual(user.id);
        const session = await UserSession.getByID(token.sessionId);
        expect(session?.startedAt.getTime()).toBeGreaterThan(Date.now() - 60 * 1000);
        expect(session?.clientType).toBe(SessionClientType.Browser);
        expect(session?.loginMethod).toBe(SessionLoginMethod.Password);

        const search = await Token.getByAccessToken(token.accessToken);
        // Make sure we do not compare the organization, since that won't be loaded now, but is loaded on user, and on token

        expect(search).toMatchObject({
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
            userId: token.userId,
            accessTokenValidUntil: token.accessTokenValidUntil,
            refreshTokenValidUntil: token.refreshTokenValidUntil,
        });
    });
});
