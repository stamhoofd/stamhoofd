import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import { Order, OrganizationFactory, Token, UserFactory, WebshopFactory } from '@stamhoofd/models';
import { Cart, CartItem, Customer, OrderData, PaymentMethod, PermissionLevel, Permissions, PrivateOrder, Product, ProductPrice, WebshopMetaData } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Language } from '@stamhoofd/types/Language';
import { v4 as uuidv4 } from 'uuid';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { PatchWebshopOrdersEndpoint } from './PatchWebshopOrdersEndpoint.js';

describe('Endpoint.PatchWebshopOrders', () => {
    const endpoint = new PatchWebshopOrdersEndpoint();

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    test('Manually created orders use the webshop default language', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();
        const token = await Token.createToken(user);

        const freeProductPrice = ProductPrice.create({ name: 'Free', price: 0, stock: 100 });
        const product = Product.create({ name: 'Product', stock: 100, prices: [freeProductPrice] });

        const webshop = await new WebshopFactory({
            organizationId: organization.id,
            meta: WebshopMetaData.patch({ defaultLanguage: Language.French }),
            products: [product],
        }).create();

        const orderData = OrderData.create({
            paymentMethod: PaymentMethod.Unknown,
            cart: Cart.create({
                items: [
                    CartItem.create({ product, productPrice: freeProductPrice, amount: 1 }),
                ],
            }),
            customer: Customer.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
            }),
        });

        const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray();
        patchArray.addPut(PrivateOrder.create({
            id: uuidv4(),
            data: orderData,
            webshopId: webshop.id,
        }));

        const r = Request.buildJson('PATCH', `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
        r.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, r);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].consumerLanguage).toEqual(Language.French);

        // Persisted in the dedicated column
        const orderModel = (await Order.getByID(response.body[0].id))!;
        expect(orderModel.consumerLanguage).toEqual(Language.French);
    });
});
