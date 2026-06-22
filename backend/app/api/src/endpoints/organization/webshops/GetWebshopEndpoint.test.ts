import { Request } from '@simonbackx/simple-endpoints';
import { Order, OrganizationFactory, Payment, Ticket, Token, UserFactory, WebshopDiscountCode, WebshopFactory } from '@stamhoofd/models';
import { OrderData, PaymentMethod, PaymentStatus, PermissionLevel, Permissions, WebshopAuthType, WebshopMetaData } from '@stamhoofd/structures';

import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { CheckWebshopDiscountCodesEndpoint } from './CheckWebshopDiscountCodesEndpoint.js';
import { GetOrderByPaymentEndpoint } from './GetOrderByPaymentEndpoint.js';
import { GetTicketsEndpoint } from './GetTicketsEndpoint.js';
import { GetWebshopEndpoint } from './GetWebshopEndpoint.js';

describe('Endpoint.GetWebshop', () => {
    // Test endpoint
    const endpoint = new GetWebshopEndpoint();

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    test('Get webshop as signed in user', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const token = await Token.createToken(user);
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

        const r = Request.buildJson('GET', '/v244/webshop/' + webshop.id, organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        expect(response.body.id).toEqual(webshop.id);
        expect((response.body as any).privateMeta).toBeUndefined();
    });

    test('Allow access without organization scope', async () => {
        const organization = await new OrganizationFactory({}).create();
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

        const r = Request.buildJson('GET', '/webshop/' + webshop.id);

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        expect(response.body.id).toEqual(webshop.id);
        expect((response.body as any).privateMeta).toBeUndefined();
    });

    test('Reject anonymous access for required-auth webshop', async () => {
        const organization = await new OrganizationFactory({}).create();
        const webshop = await new WebshopFactory({
            organizationId: organization.id,
            meta: WebshopMetaData.create({
                authType: WebshopAuthType.Required,
            }),
        }).create();

        const r = Request.buildJson('GET', '/webshop/' + webshop.id, organization.getApiHost());

        await expect(testServer.test(endpoint, r)).rejects.toThrow(STExpect.errorWithCode('not_authenticated'));
    });

    test('Allow signed in user access for required-auth webshop', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const token = await Token.createToken(user);
        const webshop = await new WebshopFactory({
            organizationId: organization.id,
            meta: WebshopMetaData.create({
                authType: WebshopAuthType.Required,
            }),
        }).create();

        const r = Request.buildJson('GET', '/webshop/' + webshop.id, organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body.id).toEqual(webshop.id);
    });

    test('Get webshop as admin', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Read,
            }),
        }).create();
        const token = await Token.createToken(user);

        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

        const r = Request.buildJson('GET', '/v244/webshop/' + webshop.id, organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        expect(response.body.id).toEqual(webshop.id);
        expect((response.body as any).privateMeta).toBeDefined();
    });

    test('Get webshop as admin that does not have access to specific webshop', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.None,
            }),
        }).create();
        const token = await Token.createToken(user);

        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

        const r = Request.buildJson('GET', '/v244/webshop/' + webshop.id, organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        expect(response.body.id).toEqual(webshop.id);
        expect((response.body as any).privateMeta).toBeUndefined();
    });

    test('Get webshop as admin of a different organization', async () => {
        const organization = await new OrganizationFactory({}).create();
        const organization2 = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization: organization2,
            permissions: Permissions.create({
                level: PermissionLevel.Read,
            }),
        }).create();

        const token = await Token.createToken(user);
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

        const r = Request.buildJson('GET', '/v244/webshop/' + webshop.id, organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect((response.body as any).privateMeta).toBeUndefined();
    });

    test('Reject discount code check for webshop from different organization', async () => {
        const otherOrganization = await new OrganizationFactory({}).create();
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const token = await Token.createToken(user);
        const webshop = await new WebshopFactory({ organizationId: otherOrganization.id }).create();

        const code = new WebshopDiscountCode();
        code.organizationId = otherOrganization.id;
        code.webshopId = webshop.id;
        code.code = 'TEST';
        await code.save();

        const r = Request.buildJson('POST', '/webshop/' + webshop.id + '/discount-codes', organization.getApiHost(), ['TEST']);
        r.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(new CheckWebshopDiscountCodesEndpoint(), r)).rejects.toThrow(STExpect.errorWithCode('not_found'));
    });

    test('Reject tickets for webshop from different organization', async () => {
        const otherOrganization = await new OrganizationFactory({}).create();
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const token = await Token.createToken(user);
        const webshop = await new WebshopFactory({ organizationId: otherOrganization.id }).create();

        const r = Request.buildJson('GET', '/webshop/' + webshop.id + '/tickets?orderId=unknown', organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(new GetTicketsEndpoint(), r)).rejects.toThrow(STExpect.errorWithCode('not_found'));
    });

    test('Reject order lookup by payment for order from another webshop', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const token = await Token.createToken(user);
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();
        const otherWebshop = await new WebshopFactory({ organizationId: organization.id }).create();

        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = PaymentMethod.Transfer;
        payment.status = PaymentStatus.Created;
        payment.price = 0;
        await payment.save();

        const order = new Order();
        order.organizationId = organization.id;
        order.webshopId = otherWebshop.id;
        order.paymentId = payment.id;
        order.data = OrderData.create({});
        await order.save();

        const r = Request.buildJson('GET', '/webshop/' + webshop.id + '/payment/' + payment.id + '/order', organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(new GetOrderByPaymentEndpoint(), r)).rejects.toThrow(STExpect.errorWithCode('not_found'));
    });

    test('Reject ticket lookup when ticket order belongs to another webshop', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const token = await Token.createToken(user);
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();
        const otherWebshop = await new WebshopFactory({ organizationId: organization.id }).create();

        const order = new Order();
        order.organizationId = organization.id;
        order.webshopId = otherWebshop.id;
        order.data = OrderData.create({});
        await order.save();

        const ticket = new Ticket();
        ticket.organizationId = organization.id;
        ticket.webshopId = webshop.id;
        ticket.orderId = order.id;
        ticket.secret = 'secret-test';
        await ticket.save();

        const r = Request.buildJson('GET', '/webshop/' + webshop.id + '/tickets?secret=' + ticket.secret, organization.getApiHost());
        r.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(new GetTicketsEndpoint(), r)).rejects.toThrow(STExpect.errorWithCode('not_found'));
    });
});
