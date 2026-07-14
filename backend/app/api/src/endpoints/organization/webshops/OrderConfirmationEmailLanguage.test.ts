import { Request } from '@simonbackx/simple-endpoints';
import { EmailMocker } from '@stamhoofd/email';
import { EmailTemplateFactory, OrganizationFactory, WebshopFactory } from '@stamhoofd/models';
import { Cart, CartItem, Customer, EmailTemplateType, OrderData, PaymentMethod, Product, ProductPrice } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';

import { testServer } from '../../../../tests/helpers/TestServer.js';
import { PlaceOrderEndpoint } from './PlaceOrderEndpoint.js';

describe('Order confirmation email language', () => {
    const endpoint = new PlaceOrderEndpoint();

    test('renders $t in the language the customer used while ordering', async () => {
        // Make French a valid locale so its real translations (loaded from disk) are actually used.
        TestUtils.setEnvironment('locales', { [Country.Belgium]: [Language.Dutch, Language.French] });

        const organization = await new OrganizationFactory({}).create();
        const freeProductPrice = ProductPrice.create({ name: 'Free', price: 0, stock: 100 });
        const product = Product.create({ name: 'Product', stock: 100, prices: [freeProductPrice] });
        const webshop = await new WebshopFactory({
            organizationId: organization.id,
            products: [product],
        }).create();

        // Confirmation email template for this webshop (auto-includes {{orderStatus}} etc.)
        await new EmailTemplateFactory({
            organization,
            webshopId: webshop.id,
            type: EmailTemplateType.OrderConfirmationOnline,
        }).create();

        // The order status label (OrderStatus.Created) is rendered via $t inside the confirmation
        // email. These are the translations looked up in shared/locales/dist/locales/digit/{nl,fr}-BE.json,
        // hardcoded on purpose so we don't verify $t with the same $t machinery we're testing.
        const dutchStatusName = 'Nieuw';
        const frenchStatusName = 'Nouveau';

        const placeFreeOrderInLanguage = async (language: string) => {
            EmailMocker.transactional.reset();

            const orderData = OrderData.create({
                paymentMethod: PaymentMethod.Unknown,
                cart: Cart.create({
                    items: [CartItem.create({ product, productPrice: freeProductPrice, amount: 1 })],
                }),
                customer: Customer.create({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+32412345678' }),
            });

            const r = Request.buildJson('POST', `/webshop/${webshop.id}/order`, organization.getApiHost(), orderData);
            r.headers['accept-language'] = language;
            await testServer.test(endpoint, r);

            const emails = await EmailMocker.transactional.getSucceededEmails();
            expect(emails).toHaveLength(1);
            return emails[0];
        };

        // French order → the $t status label is rendered in French, without Dutch leaking in
        const frenchEmail = await placeFreeOrderInLanguage('fr');
        expect(frenchEmail.html).toContain(frenchStatusName);
        expect(frenchEmail.html).not.toContain(dutchStatusName);

        // Dutch order → rendered in Dutch, without French leaking in
        const dutchEmail = await placeFreeOrderInLanguage('nl');
        expect(dutchEmail.html).toContain(dutchStatusName);
        expect(dutchEmail.html).not.toContain(frenchStatusName);
    });
});
