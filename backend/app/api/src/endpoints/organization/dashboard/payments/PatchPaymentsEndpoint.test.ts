import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import { BalanceItemFactory, OrganizationFactory, Payment, Token, UserFactory } from '@stamhoofd/models';
import { BalanceItemPaymentDetailed, PaymentGeneral, PaymentMethod, PaymentStatus, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { PatchPaymentsEndpoint } from './PatchPaymentsEndpoint.js';

describe('Endpoint.PatchPaymentsEndpoint', () => {
    const endpoint = new PatchPaymentsEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    test('should not patch a payment from another organization', async () => {
        const organization = await new OrganizationFactory({}).create();
        const otherOrganization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = await Token.createToken(user);

        const payment = new Payment();
        payment.organizationId = otherOrganization.id;
        payment.method = PaymentMethod.Transfer;
        payment.status = PaymentStatus.Created;
        payment.price = 100;
        await payment.save();

        const body: PatchableArrayAutoEncoder<PaymentGeneral> = new PatchableArray();
        body.addPatch(PaymentGeneral.patch({
            id: payment.id,
            paidAt: new Date(),
        }));

        const request = Request.buildJson('PATCH', '/organization/payments', organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(endpoint, request)).rejects.toThrow(STExpect.errorWithCode('not_found'));
    });

    test('should not create a payment for a balance item from another organization', async () => {
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

        const body: PatchableArrayAutoEncoder<PaymentGeneral> = new PatchableArray();
        body.addPut(PaymentGeneral.create({
            method: PaymentMethod.Unknown,
            status: PaymentStatus.Created,
            balanceItemPayments: [BalanceItemPaymentDetailed.create({
                price: 100,
                balanceItem: balanceItem.getStructure(),
            })],
        }));

        const request = Request.buildJson('PATCH', '/organization/payments', organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(endpoint, request)).rejects.toThrow(STExpect.errorWithCode('not_found'));
    });
});
