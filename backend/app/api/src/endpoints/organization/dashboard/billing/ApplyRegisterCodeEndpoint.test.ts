
import { Request } from '@simonbackx/simple-endpoints';
import { BalanceItem, OrganizationFactory, RegisterCodeFactory, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions } from '@stamhoofd/structures';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { ApplyRegisterCodeEndpoint } from './ApplyRegisterCodeEndpoint.js';
import { initMembershipOrganization } from '../../../../../tests/init/initMembershipOrganization.js';

describe('Endpoint.ApplyRegisterCodeEndpoint', () => {
    // Test endpoint
    const endpoint = new ApplyRegisterCodeEndpoint();

    beforeAll(async () => {
        await initMembershipOrganization();
    })

    test('Cannot apply a register code if not platform admin', async () => {
        const otherOrganization =  await new OrganizationFactory({}).create();
        const code = await new RegisterCodeFactory({organization: otherOrganization}).create();

        const organization =  await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create()
        const token = await Token.createToken(user)

        const r = Request.buildJson(
            'POST', 
            '/billing/register-code', 
            organization.getApiHost(), 
            {
                registerCode: code.code,
            }
        );
        r.headers.authorization = 'Bearer '+token.accessToken

        await expect(testServer.test(endpoint, r)).rejects.toThrow('You do not have permissions for this action');
    });

    test('Can apply a register code and apply the discount', async () => {
        const otherOrganization =  await new OrganizationFactory({}).create();
        const code = await new RegisterCodeFactory({organization: otherOrganization}).create();

        const organization =  await new OrganizationFactory({}).create();
        const user = await new UserFactory({ 
            organization,
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            email: 'admin@stamhoofd.be'
        }).create()
        const token = await Token.createToken(user)

        const r = Request.buildJson(
            'POST', 
            '/billing/register-code', 
            organization.getApiHost(), 
            {
                registerCode: code.code,
            }
        );
        r.headers.authorization = 'Bearer '+token.accessToken

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeUndefined();

        // Check if this organization has an open register code
        const credits = await BalanceItem.select().where('payingOrganizationId', organization.id).fetch();
        expect(credits.length).toBe(1);
        expect(credits[0].unitPrice).toBe(-code.value);

        // Other not yet applied because no package bought yet
        // Check if other organization has an open register code
        const otherCredits = await BalanceItem.select().where('payingOrganizationId', otherOrganization.id).fetch();
        expect(otherCredits.length).toBe(0);
    });
});
