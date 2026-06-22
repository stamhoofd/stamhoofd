import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory, StripeAccount, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { GetStripeLoginLinkEndpoint } from './GetStripeLoginLinkEndpoint.js';

describe('Endpoint.GetStripeLoginLinkEndpoint', () => {
    const endpoint = new GetStripeLoginLinkEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    test('should not get a login link for a stripe account from another organization', async () => {
        const organization = await new OrganizationFactory({}).create();
        const otherOrganization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await Token.createToken(user);

        const account = new StripeAccount();
        account.organizationId = otherOrganization.id;
        account.accountId = 'acct_test';
        await account.save();

        const request = Request.buildJson('POST', '/stripe/login-link', organization.getApiHost(), {
            accountId: account.id,
        });
        request.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(endpoint, request)).rejects.toThrow(STExpect.errorWithCode('not_found'));
    });
});
