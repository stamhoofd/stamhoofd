// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import type { User } from '@stamhoofd/models';
import { Order, OrderFactory, Organization, OrganizationFactory, UserFactory, Webshop } from '@stamhoofd/models';
import { Cart, CartItem, Customer, OrderData, PaymentMethod, Permissions, Product, ProductPrice, ProductType, RecordCategory, RecordSettings, RecordType, STPackageBundle, Token as TokenStruct, TranslatedString, Version, WebshopOrderMode, WebshopTicketType, WebshopType } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { CustomerFieldRequirement } from '@stamhoofd/structures/webshops/CustomerFieldRequirement.js';
import { CustomerSettings } from '@stamhoofd/structures/webshops/CustomerSettings.js';
import { TestUtils } from '@stamhoofd/test-utils';
import { Formatter } from '@stamhoofd/utility';
import { WebshopOrderFlow } from '../flows/WebshopOrderFlow.js';
import { DashboardPage, DashboardTab, TableHelper, WorkerData } from '../helpers/index.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

let organizationCounter = 0;

async function createOrganization({ modernWebshop }: { modernWebshop: boolean }) {
    organizationCounter += 1;
    const organization = await new OrganizationFactory({
        name: `ItemCustomerShop${WorkerData.id}-${Date.now()}-${organizationCounter}`,
        packages: [STPackageBundle.Webshops],
    }).create();

    // Recalculate meta.packages so the public webshop is not rendered as "closed"
    await STPackageService.updateOrganizationPackages(organization.id);
    const refreshed = (await Organization.getByID(organization.id))!;
    refreshed.privateMeta.featureFlags = modernWebshop ? ['modern-webshop'] : [];
    await refreshed.save();
    return refreshed;
}

async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await SessionService.createSession(user);
    const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
    const organizationId = user.organizationId;

    await page.addInitScript(({ organizationId, tokenString }) => {
        if (organizationId) {
            window.localStorage.setItem('token-' + organizationId, tokenString);
        } else {
            window.localStorage.setItem('token-platform', tokenString);
        }
    }, { organizationId, tokenString });
}

async function fetchOrders(webshopId: string) {
    return await Order.select().where('webshopId', webshopId).fetch();
}

test.describe('Webshop per-item customers @webshop-item-customer', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test('Collects a customer per item in the cart flow', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: false });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Cart customers ${WorkerData.id}`,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: () => [
                Product.create({
                    name: 'Deelname',
                    enableCustomer: true,
                    prices: [ProductPrice.create({ name: 'Standaard', price: 5_00_00 })],
                }),
                Product.create({
                    name: 'Drankje',
                    prices: [ProductPrice.create({ name: 'Standaard', price: 2_00_00 })],
                }),
            ],
        });

        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));

        // No amount input: every person is a separate item
        await flow.addProduct('Deelname', { customer: { firstName: 'Jane', lastName: 'Doe' } });
        await flow.addProduct('Deelname', { customer: { firstName: 'Jack', lastName: 'Doe' } });
        await flow.openCart();
        await expect(page.locator('.cart-item-row')).toHaveCount(2);

        await flow.goToCheckout();
        const step = page.getByTestId('customer-step');
        const list = page.getByTestId('main-customer-list');

        // The first participant is the contact person by default: only the details that weren't collected yet are asked
        await expect(list.locator('label').filter({ hasText: 'Jane Doe' }).locator('input[type="radio"]')).toBeChecked();
        await expect(step.locator('input[name="fname"]')).toHaveCount(0);

        // Someone else as contact person: the name is asked
        await flow.selectMainCustomer('Iemand anders');
        await expect(step.locator('input[name="fname"]')).toBeVisible();

        await flow.selectMainCustomer('Jane Doe');
        await expect(step.locator('input[name="fname"]')).toHaveCount(0);
        await step.locator('input[name="email"]').fill('jane@test.be');
        await step.getByTestId('save-button').click();
        await flow.confirmPayment();
        await flow.expectOrderConfirmed();

        const orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        expect(orders[0].data.customer.name).toBe('Jane Doe');
        expect(orders[0].data.customer.email).toBe('jane@test.be');
        expect(orders[0].data.customerCartItemId).toBe(orders[0].data.cart.items[0].id);
        expect(orders[0].data.cart.items.map(i => i.customer?.name)).toEqual(['Jane Doe', 'Jack Doe']);
        expect(orders[0].data.cart.items.every(i => i.amount === 1)).toBe(true);
    });

    test('Skips the customer step when the only participant already provided everything', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: false });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Single participant ${WorkerData.id}`,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: () => [
                Product.create({
                    name: 'Deelname',
                    enableCustomer: true,
                    customerSettings: CustomerSettings.create({ email: CustomerFieldRequirement.Required, birthDay: CustomerFieldRequirement.Required }),
                    prices: [ProductPrice.create({ name: 'Standaard', price: 5_00_00 })],
                }),
            ],
        });

        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.addProduct('Deelname', { customer: { firstName: 'Jane', lastName: 'Doe', email: 'jane@test.be', birthDay: { day: 1, month: 1, year: 1990 } } });

        await flow.openCart();
        await page.getByTestId('cart-checkout-button').click();
        await expect(page.getByTestId('payment-step')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('customer-step')).toHaveCount(0);
        await flow.confirmPayment();
        await flow.expectOrderConfirmed();

        const orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        expect(orders[0].data.customer.name).toBe('Jane Doe');
        expect(orders[0].data.customer.email).toBe('jane@test.be');
        expect(orders[0].data.customerCartItemId).toBe(orders[0].data.cart.items[0].id);
    });

    test('Uses the new participant after the contact person\'s cart item was replaced', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: false });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Replaced participant ${WorkerData.id}`,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: () => [
                Product.create({
                    name: 'Deelname',
                    enableCustomer: true,
                    prices: [ProductPrice.create({ name: 'Standaard', price: 5_00_00 })],
                }),
            ],
        });

        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.addProduct('Deelname', { customer: { firstName: 'Simon', lastName: 'Doe' } });

        // The only adult participant is the contact person: only the email address is still asked
        await flow.goToCheckout();
        const step = page.getByTestId('customer-step');
        await expect(step.locator('input[name="fname"]')).toHaveCount(0);
        await step.locator('input[name="email"]').fill('simon@test.be');

        // Back to the shop: replace the participant
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await page.getByTestId('cart-button').click();
        await page.locator('.cart-item-row button.trash').first().click();
        await expect(page.locator('.cart-item-row')).toHaveCount(0);
        await page.goBack();
        await flow.addProduct('Deelname', { customer: { firstName: 'Jan', lastName: 'Doe' } });

        await flow.goToCheckout();
        await expect(step.locator('input[name="fname"]')).toHaveCount(0);
        // Details filled in for the previous participant are gone
        await expect(step.locator('input[name="email"]')).toHaveValue('');
        await step.locator('input[name="email"]').fill('jan@test.be');
        await step.getByTestId('save-button').click();
        await flow.confirmPayment();
        await flow.expectOrderConfirmed();

        const orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        expect(orders[0].data.customer.name).toBe('Jan Doe');
        expect(orders[0].data.customer.email).toBe('jan@test.be');
        expect(orders[0].data.customerCartItemId).toBe(orders[0].data.cart.items[0].id);
    });

    test('Asks for a contact person when the only participant is a minor', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: false });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Minor participant ${WorkerData.id}`,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: () => [
                Product.create({
                    name: 'Deelname',
                    enableCustomer: true,
                    customerSettings: CustomerSettings.create({ email: CustomerFieldRequirement.Required, birthDay: CustomerFieldRequirement.Required }),
                    prices: [ProductPrice.create({ name: 'Standaard', price: 5_00_00 })],
                }),
            ],
        });

        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        // Ages are calculated in Brussels time
        const thisYear = Formatter.luxon(new Date()).year;
        await flow.addProduct('Deelname', { customer: { firstName: 'Kid', lastName: 'Doe', email: 'kid@test.be', birthDay: { day: 1, month: 1, year: thisYear - 10 } } });

        await flow.goToCheckout();
        // A child under 16 is not suggested as contact person, so someone else has to be filled in
        await expect(page.getByTestId('customer-step').locator('input[name="fname"]')).toBeVisible();
        await expect(page.getByTestId('main-customer-list')).toHaveCount(0);
    });

    test('Asks for a contact person when the only participant is 17, but suggests them', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: false });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Seventeen participant ${WorkerData.id}`,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: () => [
                Product.create({
                    name: 'Deelname',
                    enableCustomer: true,
                    customerSettings: CustomerSettings.create({ email: CustomerFieldRequirement.Required, birthDay: CustomerFieldRequirement.Required }),
                    prices: [ProductPrice.create({ name: 'Standaard', price: 5_00_00 })],
                }),
            ],
        });

        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        // Born on January 1st: 17 for the whole year, in Brussels time
        const thisYear = Formatter.luxon(new Date()).year;
        await flow.addProduct('Deelname', { customer: { firstName: 'Teen', lastName: 'Doe', email: 'teen@test.be', birthDay: { day: 1, month: 1, year: thisYear - 17 } } });

        await flow.goToCheckout();
        // Only adults are picked automatically: the customer step is shown, with the participant as a suggestion
        await expect(page.getByTestId('customer-step')).toBeVisible();
        await expect(page.getByTestId('main-customer-list')).toContainText('Teen Doe');
    });

    test('An admin picks the contact person from the participants and edits stay in sync', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: false });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Admin participants ${WorkerData.id}`,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: () => [
                Product.create({
                    name: 'Deelname',
                    enableCustomer: true,
                    prices: [ProductPrice.create({ name: 'Standaard', price: 5_00_00 })],
                }),
            ],
        });
        const allergies = RecordSettings.create({ name: TranslatedString.create('Allergieën'), type: RecordType.Text, required: false });
        webshop.meta.customerSettings.recordCategory = RecordCategory.create({ name: TranslatedString.create('Extra vragen'), records: [allergies] });
        await webshop.save();

        const admin = await new UserFactory({
            email: `admin-${WorkerData.id}-${Date.now()}@test.be`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        await loginAs({ page, user: admin });

        const dashboard = new DashboardPage(page);
        await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
        await dashboard.openTab(DashboardTab.Webshops);
        await page.getByTestId('webshop-menu-item').filter({ hasText: webshop.meta.name }).click();
        await page.getByTestId('open-orders-button').click();
        await page.getByTestId('table').waitFor();

        const table = new TableHelper(page);
        await table.clickAction('Bestelling toevoegen');
        const editOrderView = page.getByTestId('edit-order-view');

        // The cart comes first, so a participant can be picked as contact person below it
        await editOrderView.getByTestId('add-product-button').click();
        await page.getByTestId('product-box').filter({ hasText: 'Deelname' }).click();
        const cartItemView = page.getByTestId('cart-item-view');
        await cartItemView.locator('input[name="fname"]').fill('Jane');
        await cartItemView.locator('input[name="lname"]').fill('Doe');
        await cartItemView.getByTestId('save-button').click();

        // The participant becomes the contact person by default
        await expect(editOrderView.getByTestId('main-customer-list').locator('label').filter({ hasText: 'Jane Doe' }).locator('input[type="radio"]')).toBeChecked();
        await expect(editOrderView.getByTestId('first-name-input')).toHaveCount(0);

        // Someone else asks for a name, picking the participant again hides it
        await editOrderView.getByTestId('main-customer-list').locator('label').filter({ hasText: 'Iemand anders' }).click();
        await expect(editOrderView.getByTestId('first-name-input')).toBeVisible();
        await editOrderView.getByTestId('main-customer-list').locator('label').filter({ hasText: 'Jane Doe' }).click();
        await expect(editOrderView.getByTestId('first-name-input')).toHaveCount(0);
        await editOrderView.getByTestId('email-input').fill('jane@test.be');

        // Questions about the contact person are asked with the customer details, not in a separate category
        await expect(editOrderView.getByRole('heading', { name: 'Extra vragen' })).toHaveCount(0);
        await editOrderView.locator('.contact-person-details').getByRole('textbox').last().fill('Noten');
        await editOrderView.getByTestId('payment-method-option').filter({ has: page.locator('[value="' + PaymentMethod.PointOfSale + '"]') }).click();
        await editOrderView.getByTestId('save-button').click();
        await editOrderView.waitFor({ state: 'detached' });

        let orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        expect(orders[0].data.customer.name).toBe('Jane Doe');
        expect(orders[0].data.customer.email).toBe('jane@test.be');
        expect(orders[0].data.customerCartItemId).toBe(orders[0].data.cart.items[0].id);
        expect(orders[0].data.recordAnswers.get(allergies.id)?.stringValue).toBe('Noten');

        // Editing the participant updates the contact person too
        await table.getRow('Jane').click();
        // The answers are shown with the customer details, not under the name of their category
        await expect(page.getByTestId('order-view')).toContainText('Noten');
        await expect(page.getByTestId('order-view').getByRole('heading', { name: 'Extra vragen' })).toHaveCount(0);
        await page.getByTestId('order-view').locator('button.icon.more').first().click();
        await page.getByRole('button', { name: 'Wijzig...' }).click();
        await editOrderView.locator('.cart-item-row').first().click();
        await cartItemView.locator('input[name="fname"]').fill('Janet');
        await cartItemView.getByTestId('save-button').click();
        await expect(editOrderView.getByTestId('main-customer-list')).toContainText('Janet Doe');
        await editOrderView.getByTestId('save-button').click();
        await editOrderView.waitFor({ state: 'detached' });

        await expect.poll(async () => (await fetchOrders(webshop.id))[0].data.customer.name).toBe('Janet Doe');
        orders = await fetchOrders(webshop.id);
        expect(orders[0].data.cart.items[0].customer?.name).toBe('Janet Doe');
        expect(orders[0].data.customer.email).toBe('jane@test.be');
    });

    test('An admin still sees the amount of an older item with several pieces for one participant', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: false });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Legacy amount ${WorkerData.id}`,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: () => [
                Product.create({
                    name: 'Deelname',
                    enableCustomer: true,
                    prices: [ProductPrice.create({ name: 'Standaard', price: 5_00_00 })],
                }),
            ],
        });
        const product = webshop.products[0];

        // Placed before details were collected per item: one participant for four pieces
        const item = CartItem.create({ product, productPrice: product.prices[0], amount: 4, customer: Customer.create({ firstName: 'Jane', lastName: 'Doe' }) });
        await new OrderFactory({
            webshop,
            data: OrderData.create({
                customer: Customer.create({ firstName: 'Jane', lastName: 'Doe', email: 'jane@test.be' }),
                cart: Cart.create({ items: [item] }),
                paymentMethod: PaymentMethod.PointOfSale,
            }),
        }).create();

        const admin = await new UserFactory({
            email: `admin-${WorkerData.id}-${Date.now()}@test.be`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        await loginAs({ page, user: admin });

        const dashboard = new DashboardPage(page);
        await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
        await dashboard.openTab(DashboardTab.Webshops);
        await page.getByTestId('webshop-menu-item').filter({ hasText: webshop.meta.name }).click();
        await page.getByTestId('open-orders-button').click();
        await page.getByTestId('table').waitFor();

        const table = new TableHelper(page);
        await table.getRow('Jane').click();
        const orderView = page.getByTestId('order-view');
        await expect(orderView.locator('.cart-item-row .amount')).toHaveText('4');

        // Editing the participant keeps the four pieces: the admin is not forced down to one per participant
        await orderView.locator('button.icon.more').first().click();
        await page.getByRole('button', { name: 'Wijzig...' }).click();
        const editOrderView = page.getByTestId('edit-order-view');
        await expect(editOrderView.locator('.cart-item-row .amount')).toHaveText('4');
        await editOrderView.locator('.cart-item-row').first().click();
        const cartItemView = page.getByTestId('cart-item-view');
        await cartItemView.locator('input[name="fname"]').fill('Janet');
        await cartItemView.getByTestId('save-button').click();
        await expect(editOrderView.locator('.cart-item-row .amount')).toHaveText('4');
        await editOrderView.getByTestId('save-button').click();
        await editOrderView.waitFor({ state: 'detached' });

        await expect.poll(async () => (await fetchOrders(webshop.id))[0].data.cart.items[0].customer?.firstName).toBe('Janet');
        expect((await fetchOrders(webshop.id))[0].data.cart.items[0].amount).toBe(4);
    });

    test('Shows the name error when a participant is added without a name', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: false });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Missing name ${WorkerData.id}`,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: () => [
                Product.create({
                    name: 'Deelname',
                    enableCustomer: true,
                    prices: [ProductPrice.create({ name: 'Standaard', price: 5_00_00 })],
                }),
            ],
        });

        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await page.getByTestId('product-box').filter({ hasText: 'Deelname' }).first().click();

        const cartItemView = page.getByTestId('cart-item-view');
        await expect(cartItemView).toBeVisible();
        await cartItemView.getByTestId('save-button').click();

        // The validation error is shown at the name input instead of failing silently
        await expect(cartItemView.getByText('De voornaam die je hebt opgegeven is ongeldig', { exact: false })).toBeVisible();
        await expect(cartItemView).toBeVisible();
    });

    test('Participant settings can be configured per product in the dashboard', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: true });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Participant settings ${WorkerData.id}`,
            productCount: 1,
        });

        const admin = await new UserFactory({
            email: `admin-${WorkerData.id}-${Date.now()}@test.be`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        await loginAs({ page, user: admin });

        const dashboard = new DashboardPage(page);
        await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
        await dashboard.openTab(DashboardTab.Webshops);
        await page.getByTestId('webshop-menu-item').filter({ hasText: webshop.meta.name }).click();
        await page.getByRole('heading', { name: 'Productaanbod' }).click();
        await page.getByText('Product 1').first().click();

        await page.getByTestId('enable-customer-checkbox').click();

        // Only the name is asked by default; other built-in fields are added from the add menu
        await expect(page.getByTestId('customer-field-name')).toBeVisible();
        await expect(page.getByTestId('customer-field-email')).toHaveCount(0);
        await page.getByTestId('customer-settings-add-button').click();
        await page.getByTestId('context-menu-item-title').filter({ hasText: 'E-mailadres' }).click();
        const emailRow = page.getByTestId('customer-field-email');
        await expect(emailRow).toBeVisible();
        await expect(emailRow).not.toContainText('Optioneel');

        // A new field starts required; the row menu switches it to optional and back
        await page.getByTestId('customer-field-email-more').click();
        await page.getByTestId('context-menu-item-title').filter({ hasText: 'Optioneel' }).click();
        await expect(emailRow).toContainText('Optioneel');
        await page.getByTestId('customer-field-email-more').click();
        await page.getByTestId('context-menu-item-title').filter({ hasText: 'Verplicht' }).click();
        await expect(emailRow).not.toContainText('Optioneel');

        // An added field is no longer offered in the add menu
        await page.getByTestId('customer-settings-add-button').click();
        await expect(page.getByTestId('context-menu-item-title').filter({ hasText: 'E-mailadres' })).toHaveCount(0);
        await page.getByTestId('context-menu-item-title').filter({ hasText: 'GSM-nummer' }).click();
        await expect(page.getByTestId('customer-field-phone')).toBeVisible();
        await page.getByTestId('customer-field-phone-more').click();
        await page.getByTestId('context-menu-item-title').filter({ hasText: 'Verwijderen' }).click();
        await expect(page.getByTestId('customer-field-phone')).toHaveCount(0);

        // Extra questions open the question editor with the chosen type: the category that stores them is never shown
        await page.getByTestId('customer-settings-add-button').click();
        // Wait until the child menu opened: clicking while it still appears closes it again
        const menus = page.locator('.context-menu-container:visible');
        await expect(menus).toHaveCount(1);
        await page.getByTestId('context-menu-item-title').filter({ hasText: 'Eigen vraag' }).hover();
        await expect(menus).toHaveCount(2);
        await expect(menus.last().getByTestId('context-menu-item-title').filter({ hasText: 'Keuzemenu (kies één)' })).toBeVisible();
        await menus.last().getByTestId('context-menu-item-title').filter({ hasText: 'Keuzemenu (kies één)' }).click();
        const recordView = page.locator('.st-view').last();
        await expect(recordView.getByRole('heading', { name: 'Nieuwe vraag', level: 1 }).first()).toBeVisible();
        await expect(recordView.getByText('Keuze 1')).toBeVisible();
        await recordView.getByPlaceholder('bv. Toestemming publicatie foto’s').fill('T-shirtmaat');
        await recordView.getByTestId('save-button').click();
        await expect(page.getByText('T-shirtmaat')).toBeVisible();

        // Removing a question asks for confirmation, removing a built-in field does not
        await page.locator('.record-row').filter({ hasText: 'T-shirtmaat' }).locator('.button.more').click();
        // Without child categories there is nowhere to move the question to
        await expect(page.getByTestId('context-menu-item-title').filter({ hasText: 'Verplaats naar' })).toHaveCount(0);
        await page.getByTestId('context-menu-item-title').filter({ hasText: 'Verwijderen' }).click();
        const confirmation = page.getByTestId('centered-message');
        await expect(confirmation).toContainText('T-shirtmaat');
        await confirmation.getByTestId('centered-message-button').filter({ hasText: 'Verwijderen' }).click();
        await expect(page.getByText('T-shirtmaat')).toHaveCount(0);
        await expect(page.getByTestId('enable-customer-checkbox')).toBeVisible();

        // Save the product, then the webshop
        await page.locator('.st-view').last().getByTestId('save-button').click();
        await expect(page.getByTestId('enable-customer-checkbox')).toHaveCount(0);
        await page.locator('.st-view').last().getByTestId('save-button').click();

        await expect.poll(async () => (await Webshop.getByID(webshop.id))!.products[0].enableCustomer).toBe(true);
        expect((await Webshop.getByID(webshop.id))!.products[0].customerSettings?.email).toBe(CustomerFieldRequirement.Required);
        expect((await Webshop.getByID(webshop.id))!.products[0].customerSettings?.phone).toBe(CustomerFieldRequirement.Disabled);
    });

    test('Participant details can be switched between once per order and per ticket', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: true });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Participant mode ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            buildProducts: () => [
                Product.create({ name: 'Volwassene', type: ProductType.Ticket, prices: [ProductPrice.create({ price: 10_00_00 })] }),
                Product.create({ name: 'Kind', type: ProductType.Ticket, prices: [ProductPrice.create({ price: 5_00_00 })] }),
                Product.create({ name: 'Drankkaart', type: ProductType.Voucher, prices: [ProductPrice.create({ price: 10_00_00 })] }),
            ],
        });

        const admin = await new UserFactory({
            email: `admin-${WorkerData.id}-${Date.now()}@test.be`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        await loginAs({ page, user: admin });

        const dashboard = new DashboardPage(page);
        await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
        await dashboard.openTab(DashboardTab.Webshops);
        await page.getByTestId('webshop-menu-item').filter({ hasText: webshop.meta.name }).click();
        await page.getByRole('heading', { name: 'Bestelformulier' }).click();

        const productRow = (name: string) => page.getByTestId('participant-product').filter({ hasText: name });
        const confirmRemoval = async () => {
            await page.getByTestId('centered-message').getByTestId('centered-message-button').filter({ hasText: 'Verwijderen' }).click();
        };

        // Per ticket checks the tickets, not the voucher
        await page.getByTestId('participant-mode-item').click();
        await expect(productRow('Volwassene').locator('input[type="checkbox"]')).toBeChecked();
        await expect(productRow('Kind').locator('input[type="checkbox"]')).toBeChecked();
        await expect(productRow('Drankkaart').locator('input[type="checkbox"]')).not.toBeChecked();

        // The details of one ticket are edited without opening the product
        await productRow('Kind').click();
        const ticketView = page.locator('.st-view').last();
        await expect(ticketView.getByRole('heading', { name: 'Kind', level: 1 }).first()).toBeVisible();
        await ticketView.getByTestId('customer-settings-add-button').click();
        await page.getByTestId('context-menu-item-title').filter({ hasText: 'Geboortedatum' }).click();
        await ticketView.getByTestId('save-button').click();
        await expect(productRow('Kind')).toContainText('Geboortedatum');

        await page.locator('.st-view').last().getByTestId('save-button').click();
        await expect.poll(async () => (await Webshop.getByID(webshop.id))!.products.map(p => p.enableCustomer)).toEqual([true, true, false]);
        expect((await Webshop.getByID(webshop.id))!.products[1].customerSettings?.birthDay).toBe(CustomerFieldRequirement.Required);

        // Once per order removes the details per ticket after confirming; switching back before saving restores them
        await expect(page.getByTestId('participant-mode-order')).toHaveCount(0);
        await page.getByRole('heading', { name: 'Bestelformulier' }).click();
        await expect(productRow('Kind')).toContainText('Geboortedatum');

        // Cancelling keeps 'per ticket' selected
        await page.getByTestId('participant-mode-order').click();
        await page.getByTestId('centered-message').getByTestId('centered-message-button').filter({ hasText: 'Annuleren' }).click();
        await expect(page.getByTestId('centered-message')).toHaveCount(0);
        await expect(page.getByTestId('participant-mode-item').locator('input[type="radio"]')).toBeChecked();
        await expect(page.getByTestId('participant-mode-order').locator('input[type="radio"]')).not.toBeChecked();
        await expect(productRow('Kind')).toContainText('Geboortedatum');

        await page.getByTestId('participant-mode-order').click();
        await expect(page.getByTestId('centered-message')).toContainText('Kind');
        await confirmRemoval();
        await expect(page.getByTestId('participant-product')).toHaveCount(0);
        await page.getByTestId('participant-mode-item').click();
        await expect(productRow('Kind')).toContainText('Geboortedatum');

        await page.getByTestId('participant-mode-order').click();
        await confirmRemoval();
        await page.locator('.st-view').last().getByTestId('save-button').click();

        await expect.poll(async () => (await Webshop.getByID(webshop.id))!.products.filter(p => p.enableCustomer).length).toBe(0);
        expect((await Webshop.getByID(webshop.id))!.products.map(p => p.customerSettings)).toEqual([null, null, null]);
    });

    test('Collects a customer per ticket in bulk mode and lets the main customer be picked from them', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: true });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Bulk customers ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            type: WebshopType.Registrations,
            orderMode: WebshopOrderMode.Bulk,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: () => [
                Product.create({
                    name: 'Deelname',
                    type: ProductType.Ticket,
                    enableCustomer: true,
                    prices: [ProductPrice.create({ name: 'Standaard', price: 5_00_00 })],
                }),
            ],
        });

        const flow = new WebshopOrderFlow(page, { orderMode: WebshopOrderMode.Bulk });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));

        // Registrations wording instead of "Bestellen" / "Ticket"
        await expect(page.getByTestId('bulk-order-button')).toContainText('Inschrijven');
        // One product with one price: the first unit is preselected; the amount can also be typed
        await expect(flow.bulkAmount('Deelname')).toHaveValue('1');
        await flow.typeBulkAmount('Deelname', 2);
        await expect(flow.bulkAmount('Deelname')).toHaveValue('2');
        await flow.startBulkOrder();

        await expect(flow.detailsStep().getByTestId('details-item')).toHaveCount(2);
        await expect(flow.detailsStep().getByRole('heading', { name: 'Deelnemer 1', exact: true }).last()).toBeVisible();
        await flow.fillDetails(0, { customer: { firstName: 'Jane', lastName: 'Doe' } });
        await flow.fillDetails(1, { customer: { firstName: 'Jack', lastName: 'Doe' } });
        await flow.submitDetails();

        // The main customer can be picked from the ticket holders: their name is copied, so only the email is still asked
        const customerStep = page.getByTestId('customer-step');
        await expect(customerStep).toBeVisible({ timeout: 15000 });
        await flow.selectMainCustomer('Jack Doe');
        await expect(customerStep.locator('input[name="fname"]')).toHaveCount(0);
        await customerStep.locator('input[name="email"]').fill('jack@test.be');
        await customerStep.getByTestId('save-button').click();
        await flow.confirmPayment();
        await flow.expectTicketsDownloadable();
        await flow.expectTicketCount(2);

        const orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        expect(orders[0].data.customer.name).toBe('Jack Doe');
        expect(orders[0].data.cart.items.map(i => i.customer?.name)).toEqual(['Jane Doe', 'Jack Doe']);
    });

    test('Collects the configured participant fields and the unboxed record category', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: true });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Bulk participant settings ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            orderMode: WebshopOrderMode.Bulk,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: () => [
                Product.create({
                    name: 'Deelname',
                    type: ProductType.Ticket,
                    enableCustomer: true,
                    customerSettings: CustomerSettings.create({
                        email: CustomerFieldRequirement.Required,
                        recordCategory: RecordCategory.create({
                            name: TranslatedString.create('Extra vragen'),
                            records: [RecordSettings.create({ name: TranslatedString.create('Allergieën'), type: RecordType.Text, required: false })],
                            childCategories: [RecordCategory.create({
                                name: TranslatedString.create('Noodcontact'),
                                records: [RecordSettings.create({ name: TranslatedString.create('Naam noodcontact'), type: RecordType.Text })],
                            })],
                        }),
                    }),
                    prices: [ProductPrice.create({ name: 'Standaard', price: 5_00_00 })],
                }),
            ],
        });

        const flow = new WebshopOrderFlow(page, { orderMode: WebshopOrderMode.Bulk });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.startBulkOrder();

        const item = flow.detailsItem(0);
        await expect(item).toBeVisible({ timeout: 15000 });
        // Unboxed: the category has no title of its own, only the child category gets a subtitle
        await expect(item.getByRole('heading', { name: 'Noodcontact', exact: true })).toBeVisible();
        await expect(item.getByRole('heading', { name: 'Extra vragen', exact: true })).toHaveCount(0);

        // Email is required by the product settings
        await flow.fillDetails(0, { customer: { firstName: 'Jane', lastName: 'Doe' } });
        await flow.submitDetails();
        // Both the email and the required emergency contact are reported on this ticket
        await expect(item.locator('.error-box')).toHaveCount(2);
        await expect(page.getByTestId('customer-step')).toHaveCount(0);

        await item.locator('input[name="email"]').fill('jane@test.be');
        const recordInputs = item.locator('input.input:not([name])');
        await recordInputs.nth(0).fill('Noten');
        await recordInputs.nth(1).fill('John Doe');
        await flow.submitDetails();

        // The only participant provided everything the order asks, so they become the contact person without a customer step
        await expect(page.getByTestId('payment-step')).toBeVisible({ timeout: 15000 });
        await flow.confirmPayment();
        await flow.expectTicketsDownloadable();

        const orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        expect(orders[0].data.customer.name).toBe('Jane Doe');
        expect(orders[0].data.customer.email).toBe('jane@test.be');
        const participant = orders[0].data.cart.items[0];
        expect(participant.customer?.email).toBe('jane@test.be');
        expect([...participant.recordAnswers.values()].map(a => a.stringValue).sort()).toEqual(['John Doe', 'Noten']);
    });
});
