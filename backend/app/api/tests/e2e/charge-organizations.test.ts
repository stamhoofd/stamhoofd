import { Request } from '@simonbackx/simple-endpoints';
import type { Organization } from '@stamhoofd/models';
import { BalanceItem, OrganizationFactory } from '@stamhoofd/models';
import { BalanceItemType, ChargeRequest, VATExcemptReason, Version } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { ChargeOrganizationsEndpoint } from '../../src/endpoints/admin/organizations/ChargeOrganizationsEndpoint.js';
import { testServer } from '../helpers/TestServer.js';
import { initPlatformAdmin } from '../init/initPlatformAdmin.js';
import { initMembershipOrganization } from '../init/initMembershipOrganization.js';
import { SessionService } from '../../src/services/SessionService.js';
import { UserFactory } from '@stamhoofd/models';

describe('E2E.ChargeOrganizations', () => {
    const endpoint = new ChargeOrganizationsEndpoint();
    let chargingOrganization: Organization;

    const postCharge = async (body: ChargeRequest, accessToken: string) => {
        const request = Request.buildJson('POST', `/v${Version}/admin/charge-organizations`, chargingOrganization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + accessToken;
        return await testServer.test(endpoint, request);
    };

    const getBalanceItems = async (organization: Organization) => {
        return await BalanceItem.select().where('payingOrganizationId', organization.id).fetch();
    };

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    beforeAll(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        chargingOrganization = await initMembershipOrganization();
    });

    test('Should create balance items with description and VAT settings for organizations', async () => {
        const { adminToken } = await initPlatformAdmin();
        const organization1 = await new OrganizationFactory({}).create();
        const organization2 = await new OrganizationFactory({}).create();
        const otherOrganization = await new OrganizationFactory({}).create();

        const body = ChargeRequest.create({
            name: 'test name',
            description: 'test description',
            price: 10_00,
            amount: 2,
            VATPercentage: 21,
            VATIncluded: false,
            VATExcempt: VATExcemptReason.IntraCommunityServices,
            dueAt: new Date(2023, 0, 10),
            createdAt: new Date(2023, 0, 4),
            filter: { id: { $in: [organization1.id, organization2.id] } },
        });

        await postCharge(body, adminToken.accessToken);

        for (const organization of [organization1, organization2]) {
            const items = await getBalanceItems(organization);
            expect(items.length).toBe(1);
            const item = items[0];
            expect(item.organizationId).toBe(chargingOrganization.id);
            expect(item.type).toBe(BalanceItemType.Other);
            expect(item.name).toBe('test name');
            expect(item.description).toBe('test description');
            expect(item.unitPrice).toBe(10_00);
            expect(item.amount).toBe(2);
            expect(item.VATPercentage).toBe(21);
            expect(item.VATIncluded).toBe(false);
            expect(item.VATExcempt).toBe(VATExcemptReason.IntraCommunityServices);
            expect(item.dueAt).toEqual(body.dueAt);
            expect(item.createdAt).toEqual(body.createdAt);
        }

        expect(await getBalanceItems(otherOrganization)).toHaveLength(0);
    });

    test('Should fail without platform full access', async () => {
        const user = await new UserFactory({ organization: chargingOrganization }).create();
        const token = await SessionService.createSession(user);
        const organization = await new OrganizationFactory({}).create();

        const body = ChargeRequest.create({
            name: 'test name',
            price: 10_00,
            amount: 1,
            filter: { id: organization.id },
        });

        await expect(postCharge(body, token.accessToken))
            .rejects
            .toThrow(STExpect.errorWithCode('permission_denied'));

        expect(await getBalanceItems(organization)).toHaveLength(0);
    });
});
