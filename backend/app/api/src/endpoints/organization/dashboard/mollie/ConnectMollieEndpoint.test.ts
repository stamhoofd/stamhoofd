import { Request } from '@simonbackx/simple-endpoints';
import { MollieToken, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions } from '@stamhoofd/structures';
import { MollieRequiredScopes } from '@stamhoofd/structures/MollieScopes.js';
import { TestUtils } from '@stamhoofd/test-utils';

import { MollieMocker } from '../../../../../tests/helpers/MollieMocker.js';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../../services/SessionService.js';
import { ConnectMollieEndpoint } from './ConnectMollieEndpoint.js';

describe('Endpoint.ConnectMollie', () => {
    const endpoint = new ConnectMollieEndpoint();
    let mollieMocker: MollieMocker;

    beforeAll(() => {
        mollieMocker = new MollieMocker();
        mollieMocker.start();
    });

    afterAll(() => {
        mollieMocker.stop();
    });

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
        mollieMocker.reset();
    });

    async function connect() {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await SessionService.createSession(user);

        const request = Request.buildJson('POST', '/mollie/connect', organization.getApiHost(), { code: 'auth_code_test' });
        request.headers.authorization = 'Bearer ' + token.accessToken;
        const response = await testServer.test(endpoint, request);

        return { organization, response };
    }

    test('The granted scopes are stored on the token', async () => {
        const { organization, response } = await connect();

        const mollieToken = await MollieToken.getTokenFor(organization.id);
        expect(mollieToken?.scopes).toEqual(MollieRequiredScopes);
        expect(mollieToken?.missingScopes).toEqual([]);
        expect(response.body.privateMeta?.mollieOnboarding?.missingScopes).toEqual([]);
    });

    test('A connection that was granted fewer scopes reports the missing ones', async () => {
        mollieMocker.oauthScopes = MollieRequiredScopes.filter(s => s !== 'balances.read');

        const { organization, response } = await connect();

        const mollieToken = await MollieToken.getTokenFor(organization.id);
        expect(mollieToken?.missingScopes).toEqual(['balances.read']);
        expect(response.body.privateMeta?.mollieOnboarding?.missingScopes).toEqual(['balances.read']);
    });
});
