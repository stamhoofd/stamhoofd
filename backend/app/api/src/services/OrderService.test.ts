import { I18n } from '@stamhoofd/backend-i18n';
import { EmailMocker } from '@stamhoofd/email';
import type { Organization } from '@stamhoofd/models';
import { EmailTemplateFactory, Order, OrganizationFactory, Payment, Webshop, WebshopCounter, WebshopFactory } from '@stamhoofd/models';
import { Cart, CartItem, Customer, EmailContent, EmailTemplateType, OrderData, OrderStatus, PaymentMethod, PaymentStatus, Product, ProductPrice, ProductType, WebshopMetaData, WebshopStatus, WebshopTicketType } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { OrderService } from './OrderService.js';

/**
 * The order emails are rendered in the language the customer ordered in. The status name below is
 * rendered through $t inside the order recipient replacements, and is hardcoded on purpose so we
 * don't verify $t with the same $t machinery we're testing.
 * (translations of OrderStatus.Created in shared/locales/dist/locales/digit/{nl,fr}-BE.json)
 */
const orderStatusName = {
    [Language.Dutch]: 'Nieuw',
    [Language.French]: 'Nouveau',
};

function createCustomer() {
    return Customer.create({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
    });
}

async function createOrder(webshop: Webshop, options: { consumerLanguage?: Language; valid?: boolean; cart?: Cart; paymentMethod?: PaymentMethod } = {}) {
    const order = new Order();
    order.organizationId = webshop.organizationId;
    order.webshopId = webshop.id;
    order.status = OrderStatus.Created;
    order.consumerLanguage = options.consumerLanguage ?? Language.Dutch;
    order.data = OrderData.create({
        paymentMethod: options.paymentMethod ?? PaymentMethod.Transfer,
        customer: createCustomer(),
        cart: options.cart ?? Cart.create({}),
    });

    if (options.valid ?? true) {
        order.validAt = new Date();
        order.number = await WebshopCounter.getNextNumber(webshop);
    }

    await order.save();
    return order;
}

function loadRelations(order: Order, webshop: Webshop, organization: Organization) {
    return order.setRelation(Order.webshop, webshop.setRelation(Webshop.organization, organization));
}

async function createTransferPayment(organization: Organization) {
    const payment = new Payment();
    payment.organizationId = organization.id;
    payment.method = PaymentMethod.Transfer;
    payment.status = PaymentStatus.Succeeded;
    payment.price = 1000;
    payment.paidAt = new Date();
    await payment.save();
    return payment;
}

describe('OrderService', () => {
    describe('sendEmailTemplate', () => {
        test('renders the email in the language the customer ordered in, not the ambient language', async () => {
            // Make French a valid locale so its real translations (loaded from disk) are actually used.
            TestUtils.setEnvironment('locales', { [Country.Belgium]: [Language.Dutch, Language.French] });

            const organization = await new OrganizationFactory({}).create();
            const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

            await new EmailTemplateFactory({
                organization,
                webshopId: webshop.id,
                type: EmailTemplateType.OrderConfirmationOnline,
                subject: 'Bevestiging',
                html: '<p>{{orderStatus}}</p>',
                text: '{{orderStatus}}',
            }).create();

            const order = await createOrder(webshop, { consumerLanguage: Language.French });
            const loadedOrder = loadRelations(order, webshop, organization);

            // The ambient language is Dutch while the customer ordered in French
            await I18n.runWithLocale(new I18n(Language.Dutch, Country.Belgium), async () => {
                await OrderService.sendEmailTemplate(loadedOrder, {
                    type: EmailTemplateType.OrderConfirmationOnline,
                });
            });

            const emails = await EmailMocker.transactional.getSucceededEmails();
            expect(emails).toHaveLength(1);
            expect(emails[0].html).toContain(orderStatusName[Language.French]);
            expect(emails[0].html).not.toContain(orderStatusName[Language.Dutch]);
        });

        test('does not send anything for an archived webshop', async () => {
            const organization = await new OrganizationFactory({}).create();
            const webshop = await new WebshopFactory({
                organizationId: organization.id,
                meta: WebshopMetaData.patch({ status: WebshopStatus.Archived }),
            }).create();

            await new EmailTemplateFactory({
                organization,
                webshopId: webshop.id,
                type: EmailTemplateType.OrderConfirmationOnline,
                subject: 'Bevestiging',
                html: '<p>Bevestiging</p>',
                text: 'Bevestiging',
            }).create();

            const order = await createOrder(webshop);
            const loadedOrder = loadRelations(order, webshop, organization);

            await OrderService.sendEmailTemplate(loadedOrder, {
                type: EmailTemplateType.OrderConfirmationOnline,
            });

            expect(await EmailMocker.transactional.getSucceededEmails()).toHaveLength(0);
        });
    });

    describe('markValid', () => {
        test('sends the notification email without the customer name and in the webshop language', async () => {
            TestUtils.setEnvironment('locales', { [Country.Belgium]: [Language.Dutch, Language.French] });

            const organization = await new OrganizationFactory({}).create();
            const webshop = await new WebshopFactory({
                organizationId: organization.id,
                meta: WebshopMetaData.patch({ defaultLanguage: Language.French }),
            }).create();
            webshop.privateMeta.notificationEmails = ['admin@example.com'];
            await webshop.save();

            await new EmailTemplateFactory({
                organization,
                webshopId: webshop.id,
                type: EmailTemplateType.OrderConfirmationOnline,
                subject: 'Bevestiging',
                html: '<p>Bevestiging</p>',
                text: 'Bevestiging',
            }).create();

            // Default (Dutch) content + a French translation, so we can tell which language was selected
            await new EmailTemplateFactory({
                organization,
                webshopId: webshop.id,
                type: EmailTemplateType.OrderNotification,
                subject: 'Nederlandse melding',
                html: '<p>NL [{{firstName}}][{{lastName}}] {{orderUrl}}</p>',
                text: 'Nederlandse melding',
                language: Language.Dutch,
                translations: new Map([
                    [Language.French, EmailContent.create({
                        subject: 'Franse melding',
                        html: '<p>FR [{{firstName}}][{{lastName}}] {{orderUrl}}</p>',
                        text: 'Franse melding',
                    })],
                ]),
            }).create();

            // The customer ordered in Dutch, the webshop default language is French
            const order = await createOrder(webshop, { consumerLanguage: Language.Dutch, valid: false });
            const loadedOrder = loadRelations(order, webshop, organization);

            await OrderService.markValid(loadedOrder, null, []);

            const emails = await EmailMocker.transactional.getSucceededEmails();
            expect(emails).toHaveLength(2);

            const customerEmail = emails.find(e => e.to.includes('john@example.com'));
            const notification = emails.find(e => e.to.includes('admin@example.com'));
            expect(customerEmail).toBeDefined();
            expect(notification).toBeDefined();

            // The customer name is cleared, so the notification is not addressed to the customer
            expect(notification!.to).toBe('admin@example.com');

            // The firstName/lastName replacements are dropped, so the customer name doesn't leak
            expect(notification!.html).toContain('[][]');
            expect(notification!.html).not.toContain('John');
            expect(notification!.html).not.toContain('Doe');

            // The language falls back to the webshop default (French), not the customer's (Dutch)
            expect(notification!.subject).toBe('Franse melding');
            expect(notification!.html).toContain('FR ');

            // The orderUrl of the notification points at the dashboard, not at the webshop order page
            expect(notification!.html).toContain('/webshops/');

            // The customer still receives their own confirmation
            expect(customerEmail!.subject).toBe('Bevestiging');
        });
    });

    describe('markPaid', () => {
        test('sends the tickets email when tickets were created', async () => {
            const organization = await new OrganizationFactory({}).create();
            const productPrice = ProductPrice.create({ name: 'Standaard', price: 0 });
            const ticketProduct = Product.create({
                name: 'Ticket',
                type: ProductType.Ticket,
                prices: [productPrice],
            });

            const webshop = await new WebshopFactory({
                organizationId: organization.id,
                meta: WebshopMetaData.patch({ ticketType: WebshopTicketType.Tickets }),
                products: [ticketProduct],
            }).create();

            await new EmailTemplateFactory({
                organization,
                webshopId: webshop.id,
                type: EmailTemplateType.TicketsReceivedTransfer,
                subject: 'Tickets ontvangen',
                html: '<p>Tickets ontvangen</p>',
                text: 'Tickets ontvangen',
            }).create();

            await new EmailTemplateFactory({
                organization,
                webshopId: webshop.id,
                type: EmailTemplateType.OrderReceivedTransfer,
                subject: 'Betaling ontvangen',
                html: '<p>Betaling ontvangen</p>',
                text: 'Betaling ontvangen',
            }).create();

            const order = await createOrder(webshop, {
                cart: Cart.create({
                    items: [CartItem.create({ product: ticketProduct, productPrice, amount: 1 })],
                }),
            });

            const payment = await createTransferPayment(organization);
            await OrderService.markPaid(order, payment, organization, webshop);

            const emails = await EmailMocker.transactional.getSucceededEmails();
            expect(emails).toHaveLength(1);
            expect(emails[0].subject).toBe('Tickets ontvangen');
        });

        test('sends the paid email for a transfer payment when no tickets were created', async () => {
            const organization = await new OrganizationFactory({}).create();
            const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

            await new EmailTemplateFactory({
                organization,
                webshopId: webshop.id,
                type: EmailTemplateType.TicketsReceivedTransfer,
                subject: 'Tickets ontvangen',
                html: '<p>Tickets ontvangen</p>',
                text: 'Tickets ontvangen',
            }).create();

            await new EmailTemplateFactory({
                organization,
                webshopId: webshop.id,
                type: EmailTemplateType.OrderReceivedTransfer,
                subject: 'Betaling ontvangen',
                html: '<p>Betaling ontvangen</p>',
                text: 'Betaling ontvangen',
            }).create();

            const order = await createOrder(webshop);
            const payment = await createTransferPayment(organization);

            await OrderService.markPaid(order, payment, organization, webshop);

            const emails = await EmailMocker.transactional.getSucceededEmails();
            expect(emails).toHaveLength(1);
            expect(emails[0].subject).toBe('Betaling ontvangen');
        });

        test('does not send the paid email for a non-transfer payment when no tickets were created', async () => {
            const organization = await new OrganizationFactory({}).create();
            const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

            await new EmailTemplateFactory({
                organization,
                webshopId: webshop.id,
                type: EmailTemplateType.OrderReceivedTransfer,
                subject: 'Betaling ontvangen',
                html: '<p>Betaling ontvangen</p>',
                text: 'Betaling ontvangen',
            }).create();

            const order = await createOrder(webshop, { paymentMethod: PaymentMethod.PointOfSale });

            const payment = new Payment();
            payment.organizationId = organization.id;
            payment.method = PaymentMethod.PointOfSale;
            payment.status = PaymentStatus.Succeeded;
            payment.price = 1000;
            payment.paidAt = new Date();
            await payment.save();

            await OrderService.markPaid(order, payment, organization, webshop);

            expect(await EmailMocker.transactional.getSucceededEmails()).toHaveLength(0);
        });
    });
});
