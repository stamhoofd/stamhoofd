import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { CheckMollieResponse, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { MollieRequiredScopes } from '@stamhoofd/structures/MollieScopes.js';
import { TestUtils } from '@stamhoofd/test-utils';

import { MollieMocker } from '../../../../../tests/helpers/MollieMocker.js';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { MollieService } from '../../../../services/MollieService.js';
import { SessionService } from '../../../../services/SessionService.js';
import { CheckMollieEndpoint } from './CheckMollieEndpoint.js';

describe('Endpoint.CheckMollie', () => {
    const endpoint = new CheckMollieEndpoint();
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

    async function check(scopes: string[] | null) {
        const organization = await new OrganizationFactory({}).create();
        await mollieMocker.setupToken(organization, { scopes });
        MollieService.clearCache(organization.id);

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await SessionService.createSession(user);

        const request = Request.buildJson('POST', '/mollie/check', organization.getApiHost());
        request.headers.authorization = 'Bearer ' + token.accessToken;
        const response = await testServer.test(endpoint, request);

        return response.body as CheckMollieResponse;
    }

    test('A token with every required scope has none missing', async () => {
        const body = await check(MollieRequiredScopes);
        expect(body.organization.privateMeta?.mollieOnboarding?.missingScopes).toEqual([]);
    });

    test('A token connected without the balances scope has to be reconnected', async () => {
        const body = await check(MollieRequiredScopes.filter(s => s !== 'balances.read'));
        expect(body.organization.privateMeta?.mollieOnboarding?.missingScopes).toEqual(['balances.read']);
    });

    test('A token with unknown scopes is treated as missing all of them', async () => {
        const body = await check(null);
        expect(body.organization.privateMeta?.mollieOnboarding?.missingScopes).toEqual(MollieRequiredScopes);
    });
});
