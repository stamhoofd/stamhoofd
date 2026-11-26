import { Request } from '@node/endpoints';
import type { Organization, User } from '@stamhoofd/models';
import { OrganizationFactory, StripeAccount, UserFactory } from '@stamhoofd/models';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../../services/SessionService.js';
import { GetStripeAccountLinkEndpoint as GetStripeAccountsEndpoint } from './GetStripeAccountsEndpoint.js';

describe('Endpoint.GetStripeAccounts', () => {
    const endpoint = new GetStripeAccountsEndpoint();

    const rawStripeAccount = {
        charges_enabled: true,
        payouts_enabled: true,
        requirements: {},
        future_requirements: {},
        company: {
            name: 'Acme',
            address: { line1: 'Secret street 1' },
        },
    };

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    async function createOrganizationWithStripeAccount() {
        const organization = await new OrganizationFactory({}).create();

        const account = new StripeAccount();
        account.organizationId = organization.id;
        account.accountId = 'acct_123';
        account.setMetaFromStripeAccount(rawStripeAccount);
        await account.save();

        return organization;
    }

    async function getAccounts(organization: Organization, user: User) {
        const token = await SessionService.createSession(user);

        const r = Request.buildJson('GET', '/v3/stripe/accounts', organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toHaveLength(1);
        return response.body[0];
    }

    test('The raw Stripe account is not returned to organization admins', async () => {
        const organization = await createOrganizationWithStripeAccount();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        const account = await getAccounts(organization, user);

        expect(account.meta.blob).toBeNull();
        expect(account.meta.company?.name).toBe('Acme');
    });

    test('The raw Stripe account is not returned to platform admins', async () => {
        const organization = await createOrganizationWithStripeAccount();
        const user = await new UserFactory({
            organization,
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        const account = await getAccounts(organization, user);

        expect(account.meta.blob).toBeNull();
    });

    test('The raw Stripe account is returned to Stamhoofd staff', async () => {
        const organization = await createOrganizationWithStripeAccount();
        const user = await new UserFactory({
            organization,
            isStamhoofd: true,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        const account = await getAccounts(organization, user);

        expect(account.meta.blob).toMatchObject(rawStripeAccount);
    });
});
