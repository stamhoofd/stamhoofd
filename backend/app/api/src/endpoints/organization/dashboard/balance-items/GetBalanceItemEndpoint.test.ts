import { Request } from '@simonbackx/simple-endpoints';
import { BalanceItemFactory, OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { GetBalanceItemEndpoint } from './GetBalanceItemEndpoint.js';

describe('Endpoint.GetBalanceItemEndpoint', () => {
    const endpoint = new GetBalanceItemEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    test('should not get a balance item from another organization', async () => {
        const organization = await new OrganizationFactory({}).create();
        const otherOrganization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await Token.createToken(user);
        const balanceItem = await new BalanceItemFactory({
            organizationId: otherOrganization.id,
            userId: user.id,
            amount: 1,
            unitPrice: 100,
        }).create();

        const request = Request.buildJson('GET', '/balance-items/' + balanceItem.id, organization.getApiHost());
        request.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(endpoint, request)).rejects.toThrow(STExpect.errorWithCode('not_found'));
    });
});
