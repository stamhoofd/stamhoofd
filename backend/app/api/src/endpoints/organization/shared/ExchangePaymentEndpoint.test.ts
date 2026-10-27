import { Database } from '@node/database';
import { Request } from '@node/endpoints';
import { OrderFactory, OrganizationFactory, Payment, WebshopFactory } from '@stamhoofd/models';
import { PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';

import { testServer } from '../../../../tests/helpers/TestServer.js';
import { ExchangePaymentEndpoint } from './ExchangePaymentEndpoint.js';

describe('Endpoint.ExchangePayment', () => {
    const endpoint = new ExchangePaymentEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    async function createOrderPayment(createdAt: Date) {
        const organization = await new OrganizationFactory({}).create();
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();
        const order = await new OrderFactory({ webshop, paymentMethod: PaymentMethod.Transfer }).create();

        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = PaymentMethod.Transfer;
        payment.status = PaymentStatus.Succeeded;
        payment.price = 1000;
        await payment.save();

        createdAt.setMilliseconds(0);
        await Database.update('UPDATE `payments` SET `createdAt` = ? WHERE `id` = ?', [createdAt, payment.id]);

        order.paymentId = payment.id;
        await order.save();

        return { organization, payment };
    }

    test('An order payment created less than an hour ago can be read without authentication', async () => {
        const { organization, payment } = await createOrderPayment(new Date(Date.now() - 30 * 60 * 1000));

        const r = Request.buildJson('POST', '/payments/' + payment.id, organization.getApiHost());
        const response = await testServer.test(endpoint, r);

        expect(response.body?.id).toEqual(payment.id);
    });

    test('An order payment created more than an hour ago cannot be read without authentication', async () => {
        const { organization, payment } = await createOrderPayment(new Date(Date.now() - 90 * 60 * 1000));

        const r = Request.buildJson('POST', '/payments/' + payment.id, organization.getApiHost());
        await expect(testServer.test(endpoint, r)).rejects.toThrow(STExpect.simpleError({ code: 'permission_denied' }));
    });
});
