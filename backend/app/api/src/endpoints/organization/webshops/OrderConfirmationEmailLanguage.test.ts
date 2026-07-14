import { Request } from '@simonbackx/simple-endpoints';
import { EmailMocker } from '@stamhoofd/email';
import { EmailTemplateFactory, OrganizationFactory, WebshopFactory } from '@stamhoofd/models';
import { Cart, CartItem, Customer, EmailContent, EmailTemplateType, OrderData, PaymentMethod, Product, ProductPrice } from '@stamhoofd/structures';
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

    test('selects the translated template that matches the language the customer ordered in', async () => {
        TestUtils.setEnvironment('locales', { [Country.Belgium]: [Language.Dutch, Language.French] });

        const organization = await new OrganizationFactory({}).create();
        const freeProductPrice = ProductPrice.create({ name: 'Free', price: 0, stock: 100 });
        const product = Product.create({ name: 'Product', stock: 100, prices: [freeProductPrice] });
        const webshop = await new WebshopFactory({
            organizationId: organization.id,
            products: [product],
        }).create();

        // The template has default (Dutch) content and a French translation. The French translation
        // must be selected for a French order, the default content for a Dutch order.
        // Both order-table replacements are included: their headers/titles are localized per
        // recipient (consumer) language, independently of the selected template translation.
        const tables = '{{orderTable}} {{orderDetailsTable}}';
        await new EmailTemplateFactory({
            organization,
            webshopId: webshop.id,
            type: EmailTemplateType.OrderConfirmationOnline,
            subject: 'Standaard onderwerp',
            html: `<p>Standaard inhoud ${tables}</p>`,
            text: 'Standaard inhoud',
            translations: new Map([
                [Language.French, EmailContent.create({ subject: 'Sujet français', html: `<p>Contenu français ${tables}</p>`, text: 'Contenu français' })],
            ]),
        }).create();

        // Table headers/titles rendered via $t inside the order tables. Hardcoded on purpose so we
        // don't verify $t with the same $t machinery we're testing.
        // orderTable column headers (%Sc / %M4) and an orderDetailsTable row title (%xA).
        const dutch = { orderColumn: 'Artikel', amountColumn: 'Aantal', orderNumberTitle: 'Bestelnummer' };
        const french = { orderColumn: 'Article', amountColumn: 'Nombre', orderNumberTitle: 'Numéro de commande' };

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

        // French order → the French translation of the template is used
        const frenchEmail = await placeFreeOrderInLanguage('fr');
        expect(frenchEmail.subject).toBe('Sujet français');
        expect(frenchEmail.html).toContain('Contenu français');
        expect(frenchEmail.html).not.toContain('Standaard inhoud');

        // Both order tables are rendered in the recipient's (consumer) language, French
        expect(frenchEmail.html).toContain(french.orderColumn);
        expect(frenchEmail.html).toContain(french.amountColumn);
        expect(frenchEmail.html).toContain(french.orderNumberTitle);
        // No Dutch table headers/titles leak into the French email
        expect(frenchEmail.html).not.toContain(dutch.orderColumn);
        expect(frenchEmail.html).not.toContain(dutch.amountColumn);
        expect(frenchEmail.html).not.toContain(dutch.orderNumberTitle);

        // Dutch order → no Dutch translation exists, so the default content is used
        const dutchEmail = await placeFreeOrderInLanguage('nl');
        expect(dutchEmail.subject).toBe('Standaard onderwerp');
        expect(dutchEmail.html).toContain('Standaard inhoud');
        expect(dutchEmail.html).not.toContain('Contenu français');

        // Both order tables are rendered in Dutch
        expect(dutchEmail.html).toContain(dutch.orderColumn);
        expect(dutchEmail.html).toContain(dutch.amountColumn);
        expect(dutchEmail.html).toContain(dutch.orderNumberTitle);
        // No French table headers/titles leak into the Dutch email
        expect(dutchEmail.html).not.toContain(french.orderColumn);
        expect(dutchEmail.html).not.toContain(french.amountColumn);
        expect(dutchEmail.html).not.toContain(french.orderNumberTitle);
    });
});
