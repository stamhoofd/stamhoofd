import { Request } from '@simonbackx/simple-endpoints';
import type { BalanceItem, Organization, User } from '@stamhoofd/models';
import { BalanceItemFactory, BalanceItemPayment, MemberFactory, OrganizationFactory, Payment, UserFactory } from '@stamhoofd/models';
import { PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';
import { GetUserDetailedPayableBalanceEndpoint } from './GetUserDetailedPayableBalanceEndpoint.js';

const endpoint = new GetUserDetailedPayableBalanceEndpoint();

describe('Endpoint.GetUserDetailedPayableBalanceEndpoint', () => {
    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    async function createPayment(organization: Organization, balanceItem: BalanceItem, payingUserId: string | null = null) {
        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.payingUserId = payingUserId;
        payment.method = PaymentMethod.Transfer;
        payment.status = PaymentStatus.Pending;
        payment.price = balanceItem.price;
        await payment.save();

        const balanceItemPayment = new BalanceItemPayment();
        balanceItemPayment.balanceItemId = balanceItem.id;
        balanceItemPayment.paymentId = payment.id;
        balanceItemPayment.organizationId = organization.id;
        balanceItemPayment.price = balanceItem.price;
        await balanceItemPayment.save();

        return payment;
    }

    async function fetchBalance(organization: Organization, user: User) {
        const token = await SessionService.createSession(user);
        const request = Request.get({
            path: '/user/payable-balance/detailed',
            host: organization.getApiHost(),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });
        return await testServer.test(endpoint, request);
    }

    test('A user without members gets its own balance items and payments', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();

        const balanceItem = await new BalanceItemFactory({ organizationId: organization.id, userId: user.id, amount: 1, unitPrice: 1000 }).create();
        const payment = await createPayment(organization, balanceItem, user.id);

        const response = await fetchBalance(organization, user);
        expect(response.status).toBe(200);
        expect(response.body.organizations).toHaveLength(1);
        expect(response.body.organizations[0].balanceItems).toEqual([expect.objectContaining({ id: balanceItem.id })]);
        expect(response.body.organizations[0].payments).toEqual([expect.objectContaining({ id: payment.id })]);
    });

    test('A user without members and without balance items gets an empty response', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();

        const response = await fetchBalance(organization, user);
        expect(response.status).toBe(200);
        expect(response.body.organizations).toHaveLength(0);
    });

    test('Payments for balance items of a linked member are included', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const member = await new MemberFactory({ organization, user }).create();

        const balanceItem = await new BalanceItemFactory({ organizationId: organization.id, memberId: member.id, amount: 1, unitPrice: 1000 }).create();
        const payment = await createPayment(organization, balanceItem);

        const otherMember = await new MemberFactory({ organization }).create();
        const otherBalanceItem = await new BalanceItemFactory({ organizationId: organization.id, memberId: otherMember.id, amount: 1, unitPrice: 1000 }).create();
        await createPayment(organization, otherBalanceItem);

        const response = await fetchBalance(organization, user);
        expect(response.status).toBe(200);
        expect(response.body.organizations).toHaveLength(1);
        expect(response.body.organizations[0].balanceItems).toEqual([expect.objectContaining({ id: balanceItem.id })]);
        expect(response.body.organizations[0].payments).toEqual([expect.objectContaining({ id: payment.id })]);
    });
});
