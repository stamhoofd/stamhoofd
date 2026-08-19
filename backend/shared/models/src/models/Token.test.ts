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
        const session = new UserSession();
        session.userId = user.id;
        session.clientType = SessionClientType.Browser;
        session.loginMethod = SessionLoginMethod.Password;
        session.deviceType = SessionDeviceType.Desktop;
        session.startedAt = new Date();
        session.lastUsedTokenId = tokenId;
        session.lastActiveTokenId = tokenId;
        await session.save();

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

});
