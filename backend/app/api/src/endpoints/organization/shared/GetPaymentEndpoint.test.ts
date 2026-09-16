import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, Registration, Token } from '@stamhoofd/models';
import { BalanceItemFactory, BalanceItemPayment, GroupFactory, MemberFactory, OrganizationFactory, Payment, RegistrationFactory, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import { AccessRight, BalanceItemStatus, BalanceItemType, PaymentMethod, PaymentStatus, PermissionLevel, PermissionRoleDetailed, Permissions, PermissionsResourceType, ResourcePermissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';
import { GetPaymentEndpoint } from './GetPaymentEndpoint.js';

describe('Endpoint.GetPaymentEndpoint', () => {
    const endpoint = new GetPaymentEndpoint();
    const price = 123_450000;

    /**
     * Creates a paid registration, together with a user whose only permission is reading the group
     * of that registration, plus the passed access rights.
     */
    async function setupPaidRegistration(accessRights: AccessRight[]) {
        TestUtils.setEnvironment('userMode', 'platform');

        const period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2023, 11, 31),
        }).create();

        const role = PermissionRoleDetailed.create({
            name: 'Test Role',
            accessRights,
        });

        const organization = await new OrganizationFactory({ period, roles: [role] }).create();
        const group = await new GroupFactory({ organization, period }).create();

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.None,
                roles: [role],
                resources: new Map([[
                    PermissionsResourceType.Groups, new Map([[
                        group.id,
                        ResourcePermissions.create({
                            level: PermissionLevel.Read,
                            accessRights,
                        }),
                    ]]),
                ]]),
            }),
        }).create();

        const token = await SessionService.createSession(user);
        const member = await new MemberFactory({}).create();
        const registration: Registration = await new RegistrationFactory({ member, group }).create();

        const balanceItem = await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: member.id,
            registrationId: registration.id,
            type: BalanceItemType.Registration,
            amount: 1,
            unitPrice: price,
            status: BalanceItemStatus.Due,
            description: 'Openstaand lidgeld',
        }).create();

        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = PaymentMethod.Transfer;
        payment.status = PaymentStatus.Succeeded;
        payment.price = balanceItem.priceOpen;
        payment.paidAt = new Date();
        await payment.save();

        const balanceItemPayment = new BalanceItemPayment();
        balanceItemPayment.organizationId = organization.id;
        balanceItemPayment.paymentId = payment.id;
        balanceItemPayment.balanceItemId = balanceItem.id;
        balanceItemPayment.price = balanceItem.priceOpen;
        await balanceItemPayment.save();

        return { organization, payment, token };
    }

    const getPayment = async ({ organization, paymentId, token }: { organization: Organization; paymentId: string; token: Token }) => {
        const request = Request.get({
            path: '/payments/' + paymentId,
            host: organization.getApiHost(),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });

        return await testServer.test(endpoint, request);
    };

    test('A user without MemberReadFinancialData cannot read the payment of a registration they can read', async () => {
        const { organization, payment, token } = await setupPaidRegistration([]);

        // Read access to the group of a registration is not read access to what was paid for it
        await expect(getPayment({ organization, paymentId: payment.id, token })).rejects.toThrow(
            STExpect.errorWithCode('permission_denied'),
        );
    });

    test('A user with MemberReadFinancialData can read the payment of a registration they can read', async () => {
        const { organization, payment, token } = await setupPaidRegistration([AccessRight.MemberReadFinancialData]);

        const response = await getPayment({ organization, paymentId: payment.id, token });

        expect(response.status).toBe(200);
        expect(response.body.price).toBe(price);
        expect(response.body.balanceItemPayments).toHaveLength(1);
    });
});
