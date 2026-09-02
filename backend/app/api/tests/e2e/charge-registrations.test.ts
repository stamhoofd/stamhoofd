import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, RegistrationPeriod, Token } from '@stamhoofd/models';
import { BalanceItem, MemberFactory, OrganizationFactory, RegistrationFactory, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import { AccessRight, ChargeRequest, PermissionLevel, PermissionRoleDetailed, Permissions, PermissionsResourceType, ResourcePermissions, VATExcemptReason, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { ChargeRegistrationsEndpoint } from '../../src/endpoints/admin/registrations/ChargeRegistrationsEndpoint.js';
import { SessionService } from '../../src/services/SessionService.js';
import { testServer } from '../helpers/TestServer.js';

describe('E2E.ChargeRegistrations', () => {
    const endpoint = new ChargeRegistrationsEndpoint();
    let period: RegistrationPeriod;
    let organization: Organization;
    let financialDirectorToken: Token;

    const postCharge = async (body: ChargeRequest) => {
        const request = Request.buildJson('POST', `/v${Version}/admin/charge-registrations`, organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + financialDirectorToken.accessToken;
        return await testServer.test(endpoint, request);
    };

    const getBalanceItems = async (memberId: string) => {
        return await BalanceItem.select().where('memberId', memberId).fetch();
    };

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    beforeAll(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2023, 11, 31),
        }).create();

        const role = PermissionRoleDetailed.create({
            name: 'financial director',
            accessRights: [AccessRight.OrganizationFinanceDirector],
        });
        organization = await new OrganizationFactory({ period, roles: [role] }).create();

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.None,
                roles: [role],
                resources: new Map([[PermissionsResourceType.Groups, new Map([[
                    '',
                    ResourcePermissions.create({ level: PermissionLevel.Write }),
                ]])]]),
            }),
        }).create();
        financialDirectorToken = await SessionService.createSession(user);
    });

    test('Should charge each member once with description and VAT settings', async () => {
        const member1 = await new MemberFactory({}).create();
        const member2 = await new MemberFactory({}).create();
        const otherMember = await new MemberFactory({}).create();

        const registration1a = await new RegistrationFactory({ member: member1, organization }).create();
        const registration1b = await new RegistrationFactory({ member: member1, organization }).create();
        const registration2 = await new RegistrationFactory({ member: member2, organization }).create();
        await new RegistrationFactory({ member: otherMember, organization }).create();

        const body = ChargeRequest.create({
            name: 'test name',
            description: 'test description',
            price: 10_00,
            amount: 2,
            VATPercentage: 21,
            VATIncluded: false,
            VATExcempt: VATExcemptReason.IntraCommunityServices,
            filter: { id: { $in: [registration1a.id, registration1b.id, registration2.id] } },
        });

        await postCharge(body);

        for (const member of [member1, member2]) {
            const items = await getBalanceItems(member.id);
            expect(items.length).toBe(1);
            const item = items[0];
            expect(item.organizationId).toBe(organization.id);
            expect(item.name).toBe('test name');
            expect(item.description).toBe('test description');
            expect(item.unitPrice).toBe(10_00);
            expect(item.amount).toBe(2);
            expect(item.VATPercentage).toBe(21);
            expect(item.VATIncluded).toBe(false);
            expect(item.VATExcempt).toBe(VATExcemptReason.IntraCommunityServices);
        }

        expect(await getBalanceItems(otherMember.id)).toHaveLength(0);
    });
});
