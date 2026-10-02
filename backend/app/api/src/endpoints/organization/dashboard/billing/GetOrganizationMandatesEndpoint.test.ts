import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, Token } from '@stamhoofd/models';
import { OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { AccessRight } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { SessionService } from '../../../../services/SessionService.js';
import { MollieMocker } from '../../../../../tests/helpers/MollieMocker.js';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { initAdmin } from '../../../../../tests/init/index.js';
import { initMembershipOrganization } from '../../../../../tests/init/initMembershipOrganization.js';
import { GetOrganizationMandatesEndpoint } from './GetOrganizationMandatesEndpoint.js';

describe('Endpoint.GetOrganizationMandatesEndpoint', () => {
    const endpoint = new GetOrganizationMandatesEndpoint();
    let mollieMocker: MollieMocker;
    let sellingOrganization: Organization;

    beforeAll(async () => {
        TestUtils.setEnvironment('userMode', 'organization');
        mollieMocker = new MollieMocker();
        mollieMocker.start();

        sellingOrganization = await initMembershipOrganization();
        await mollieMocker.setupToken(sellingOrganization);
    });

    afterAll(() => {
        mollieMocker.stop();
    });

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        mollieMocker.reset();
    });

    const get = async (organization: Organization, token: Token, sellingOrganizationId = sellingOrganization.id) => {
        const request = Request.buildJson('GET', `/billing/${sellingOrganizationId}/mandates`, organization.getApiHost());
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };

    const init = async () => {
        const organization = await new OrganizationFactory({}).create();

        const customerId = mollieMocker.createId('cst');
        mollieMocker.customers.push({ id: customerId });
        const mandate = mollieMocker.addMandate({ customerId, cardNumber: '1234' });

        organization.serverMeta.mollieCustomerId = customerId;
        organization.serverMeta.mollieMandateId = mandate.id;
        await organization.save();

        return { organization, mandate };
    };

    test('A finance director of the paying organization can view the mandates', async () => {
        const { organization, mandate } = await init();
        const { adminToken } = await initAdmin({ organization, accessRights: [AccessRight.OrganizationFinanceDirector] });

        const response = await get(organization, adminToken);
        expect(response.status).toBe(200);
        expect(response.body.map(m => m.id)).toEqual([mandate.id]);
    });

    test('A seller admin with only payment access can view the mandates', async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        const { organization, mandate } = await init();
        const { adminToken: sellerToken } = await initAdmin({ organization: sellingOrganization, accessRights: [AccessRight.OrganizationManagePayments] });

        const response = await get(organization, sellerToken);
        expect(response.status).toBe(200);
        expect(response.body.map(m => m.id)).toEqual([mandate.id]);
    });

    test('Users without finance access cannot view the mandates', async () => {
        const { organization } = await init();
        const { adminToken } = await initAdmin({ organization, accessRights: [AccessRight.OrganizationCreateWebshops] });
        const { adminToken: paymentsToken } = await initAdmin({ organization, accessRights: [AccessRight.OrganizationManagePayments] });
        const member = await new UserFactory({ organization }).create();
        const memberToken = await SessionService.createSession(member);

        await expect(get(organization, adminToken)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
        await expect(get(organization, paymentsToken)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
        await expect(get(organization, memberToken)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
    });

    test('A payments admin of an unrelated organization cannot see mandates by passing their own organization as seller', async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        const { organization } = await init();
        const otherOrganization = await new OrganizationFactory({}).create();
        await mollieMocker.setupToken(otherOrganization);
        const { adminToken } = await initAdmin({ organization: otherOrganization, accessRights: [AccessRight.OrganizationManagePayments] });

        const response = await get(organization, adminToken, otherOrganization.id);
        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });
});
