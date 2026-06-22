import { Request } from '@simonbackx/simple-endpoints';
import { BalanceItemFactory, OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { CountFilteredRequest, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { GetBalanceItemEndpoint } from './GetBalanceItemEndpoint.js';
import { GetBalanceItemsCountEndpoint } from './GetBalanceItemsCountEndpoint.js';

describe('Endpoint.GetBalanceItemEndpoint', () => {
    const endpoint = new GetBalanceItemEndpoint();
    const countEndpoint = new GetBalanceItemsCountEndpoint();

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

    test('should only count balance items from the scoped organization', async () => {
        const organization = await new OrganizationFactory({}).create();
        const otherOrganization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await Token.createToken(user);
        await new BalanceItemFactory({
            organizationId: organization.id,
            userId: user.id,
            amount: 1,
            unitPrice: 100,
        }).create();
        await new BalanceItemFactory({
            organizationId: otherOrganization.id,
            userId: user.id,
            amount: 1,
            unitPrice: 100,
        }).create();

        const request = Request.get({
            path: '/balance-items/count',
            host: organization.getApiHost(),
            query: new CountFilteredRequest({
                filter: {},
            }),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });

        const result = await testServer.test(countEndpoint, request);
        expect(result.body.count).toBe(1);
    });
});
