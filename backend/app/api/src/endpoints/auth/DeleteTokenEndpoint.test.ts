import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory, Token, UserFactory, UserSession } from '@stamhoofd/models';

import { testServer } from '../../../tests/helpers/TestServer.js';
import { SessionService } from '../../services/SessionService.js';
import { DeleteTokenEndpoint } from './DeleteTokenEndpoint.js';

describe('Endpoint.DeleteToken', () => {
    const endpoint = new DeleteTokenEndpoint();

    test('ends the session and deletes every token in it', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const original = await SessionService.createSession(user);
        const renewed = await SessionService.rotateSession(original);
        const otherSession = await SessionService.createSession(user);

        const request = Request.buildJson('DELETE', '/oauth/token', organization.getApiHost());
        request.headers.authorization = 'Bearer ' + original.accessToken;
        await testServer.test(endpoint, request);

        expect(await UserSession.getByID(original.sessionId)).toBeUndefined();
        expect(await Token.getByAccessToken(original.accessToken, true)).toBeUndefined();
        expect(await Token.getByAccessToken(renewed.accessToken, true)).toBeUndefined();
        expect(await UserSession.getByID(otherSession.sessionId)).toBeDefined();
        expect(await Token.getByAccessToken(otherSession.accessToken, true)).toBeDefined();
    });

});
