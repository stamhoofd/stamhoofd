import { Database } from '@simonbackx/simple-database';
import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory, WebshopDiscountCode, WebshopFactory } from '@stamhoofd/models';
import { Discount } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

import { testServer } from '../../../../tests/helpers/TestServer.js';
import { CheckWebshopDiscountCodesEndpoint } from './CheckWebshopDiscountCodesEndpoint.js';

const endpoint = new CheckWebshopDiscountCodesEndpoint();

describe('Endpoint.CheckWebshopDiscountCodes', () => {
    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        await Database.delete('DELETE FROM `webshop_discount_codes`');
    });

    test('returns matching codes without the email they were sent to', async () => {
        const organization = await new OrganizationFactory({}).create();
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

        const model = new WebshopDiscountCode();
        model.organizationId = organization.id;
        model.webshopId = webshop.id;
        model.code = 'SPONSOR';
        model.email = 'sponsor@example.com';
        model.discounts = [Discount.create({})];
        await model.save();

        const response = await testServer.test(endpoint, Request.buildJson('POST', `/webshop/${webshop.id}/discount-codes`, organization.getApiHost(), ['SPONSOR', 'UNKNOWN']));
        expect(response.body).toHaveLength(1);
        expect(response.body[0].code).toBe('SPONSOR');
        expect(JSON.stringify(response.body)).not.toContain('sponsor@example.com');
        expect(JSON.stringify(response.body)).not.toContain('"email"');
    });
});
