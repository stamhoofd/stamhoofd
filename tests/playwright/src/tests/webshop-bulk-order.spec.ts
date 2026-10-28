// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import type { User } from '@stamhoofd/models';
import { Order, Organization, OrganizationFactory, UserFactory, Webshop, WebshopDiscountCode } from '@stamhoofd/models';
import { Discount, GeneralDiscount, Option, OptionMenu, PaymentMethod, Permissions, Product, ProductPrice, ProductType, ReservedSeat, STPackageBundle, Token as TokenStruct, Version, WebshopField, WebshopOrderMode, WebshopTicketType } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { TestUtils } from '@stamhoofd/test-utils';
import { WebshopOrderFlow } from '../flows/WebshopOrderFlow.js';
import { DashboardPage, DashboardTab, WorkerData } from '../helpers/index.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

let organizationCounter = 0;

async function createOrganization({ modernWebshop }: { modernWebshop: boolean }) {
    organizationCounter += 1;
    const organization = await new OrganizationFactory({
        name: `BulkShop${WorkerData.id}-${Date.now()}-${organizationCounter}`,
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

function mealMenu() {
    return OptionMenu.create({
        name: 'Maaltijd',
        multipleChoice: false,
        autoSelectFirst: false,
        options: [Option.create({ name: 'Vegetarisch' }), Option.create({ name: 'Vlees', price: 2_00_00 })],
    });
}

async function fetchOrders(webshopId: string) {
    return await Order.select().where('webshopId', webshopId).fetch();
}

test.describe('Webshop bulk ordering @webshop-bulk', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test('Orders seated tickets and a product with options in one go', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: true });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Bulk tickets ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            orderMode: WebshopOrderMode.Bulk,
            withSeatingPlan: true,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: ({ seatingPlanId }) => [
                Product.create({
                    name: 'Voorstelling',
                    type: ProductType.Ticket,
                    prices: [ProductPrice.create({ name: 'Standaard', price: 10_00_00 })],
                    seatingPlanId,
                }),
                Product.create({
                    name: 'Workshop',
                    type: ProductType.Ticket,
                    prices: [ProductPrice.create({ name: 'Standaard', price: 5_00_00 })],
                    optionMenus: [mealMenu()],
                    customFields: [WebshopField.create({ name: 'Naam op badge', required: true })],
                }),
            ],
        });

        const flow = new WebshopOrderFlow(page, { orderMode: WebshopOrderMode.Bulk });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));

        await flow.setBulkAmount('Voorstelling', 2);
        await flow.setBulkAmount('Workshop', 1);
        await expect(flow.bulkAmount('Voorstelling')).toHaveValue('2');
        await flow.startBulkOrder();

        // Seats are chosen once for both tickets of the seated product
        await flow.chooseBulkSeats('Voorstelling', 2);

        // Only the workshop needs details
        await expect(flow.detailsStep().getByTestId('details-item')).toHaveCount(1);
        await flow.fillDetails(0, { option: 'Vlees', field: 'Alice' });
        await flow.submitDetails();

        await flow.fillCustomer();
        await flow.confirmPayment();
        await flow.expectTicketsDownloadable();
        await flow.expectTicketCount(3);

        const orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        // The units with the same choices are one item in the order
        const items = orders[0].data.cart.items;
        expect(items).toHaveLength(2);
        const seated = items.find(i => i.product.name === 'Voorstelling')!;
        expect(seated.amount).toBe(2);
        expect(seated.seats).toHaveLength(2);
        const workshop = items.find(i => i.product.name === 'Workshop')!;
        expect(workshop.options[0].option.name).toBe('Vlees');
        expect(workshop.fieldAnswers[0].answer).toBe('Alice');
        expect(orders[0].data.totalPrice).toBe(2 * 10_00_00 + 5_00_00 + 2_00_00);
    });

    test('Skips the seat and details steps when nothing needs them, preselects a single product', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: true });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Bulk simple ${WorkerData.id}`,
            orderMode: WebshopOrderMode.Bulk,
            productCount: 1,
            paymentMethods: [PaymentMethod.PointOfSale],
        });

        const flow = new WebshopOrderFlow(page, { orderMode: WebshopOrderMode.Bulk });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));

        // One product with one price: a unit is preselected, so the visitor can order right away
        await expect(flow.bulkAmount('Product 1')).toHaveValue('1');
        await flow.startBulkOrder();
        await flow.fillCustomer();
        await flow.confirmPayment();
        await flow.expectOrderConfirmed();

        const orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        expect(orders[0].data.cart.items).toHaveLength(1);
        expect(orders[0].data.cart.items[0].amount).toBe(1);
    });

    test('Non-multiple products use a checkbox or a price selection and never exceed one unit', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: true });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Bulk single units ${WorkerData.id}`,
            orderMode: WebshopOrderMode.Bulk,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: () => [
                Product.create({
                    name: 'Lidkaart',
                    allowMultiple: false,
                    prices: [ProductPrice.create({ name: 'Standaard', price: 3_00_00 })],
                }),
                Product.create({
                    name: 'Abonnement',
                    allowMultiple: false,
                    prices: [ProductPrice.create({ name: 'Maandelijks', price: 10_00_00 }), ProductPrice.create({ name: 'Jaarlijks', price: 100_00_00 })],
                }),
            ],
        });

        const flow = new WebshopOrderFlow(page, { orderMode: WebshopOrderMode.Bulk });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));

        // An empty cart explains itself instead of a disabled button
        await flow.startBulkOrder();
        await expect(page.getByText('Maak eerst een keuze')).toBeVisible();
        await expect(page.getByTestId('customer-step')).toHaveCount(0);
        // Clicking anywhere on the row toggles the checkbox
        await page.getByTestId('bulk-product-row').filter({ hasText: 'Lidkaart' }).getByText('Lidkaart').click();
        await expect(page.getByTestId('bulk-product-row').filter({ hasText: 'Lidkaart' }).getByTestId('bulk-checkbox').locator('input')).toBeChecked();
        await flow.selectBulkPrice('Abonnement', 'Maandelijks');
        // Switching the price replaces the unit instead of adding one; the trash button clears it
        await flow.selectBulkPrice('Abonnement', 'Jaarlijks');
        await page.getByTestId('bulk-product-row').filter({ hasText: 'Abonnement' }).getByTestId('bulk-clear-product').click();
        await expect(page.getByTestId('bulk-product-row').filter({ hasText: 'Abonnement' }).getByTestId('bulk-clear-product')).toHaveCount(0);
        await flow.selectBulkPrice('Abonnement', 'Jaarlijks');

        await flow.startBulkOrder();
        await flow.fillCustomer();
        await flow.confirmPayment();
        await flow.expectOrderConfirmed();

        const orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        const items = orders[0].data.cart.items;
        expect(items.map(i => i.product.name + ':' + i.productPrice.name).sort()).toEqual(['Abonnement:Jaarlijks', 'Lidkaart:Standaard']);
        expect(orders[0].data.totalPrice).toBe(3_00_00 + 100_00_00);
    });

    test('Returns to the seats step when a seat got taken in the meantime', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: true });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Bulk errors ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            orderMode: WebshopOrderMode.Bulk,
            withSeatingPlan: true,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: ({ seatingPlanId }) => [
                Product.create({
                    name: 'Voorstelling',
                    type: ProductType.Ticket,
                    prices: [ProductPrice.create({ name: 'Standaard', price: 10_00_00 })],
                    seatingPlanId,
                    optionMenus: [mealMenu()],
                }),
            ],
        });

        const flow = new WebshopOrderFlow(page, { orderMode: WebshopOrderMode.Bulk });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));

        // The single unit is preselected
        await expect(flow.bulkAmount('Voorstelling')).toHaveValue('1');
        await flow.startBulkOrder();
        await flow.chooseBulkSeats('Voorstelling', 1);
        await flow.fillDetails(0, { option: 'Vegetarisch' });
        await flow.submitDetails();
        await flow.fillCustomer();

        // Someone else takes the first seat (A1) while this visitor is at the payment step
        const seatingPlan = TestWebshops.seatingPlanOf(webshop);
        const model = (await Webshop.getByID(webshop.id))!;
        model.products[0].reservedSeats.push(ReservedSeat.create({
            section: seatingPlan.sections[0].id,
            row: seatingPlan.sections[0].rows[0].label,
            seat: seatingPlan.sections[0].rows[0].seats[0].label,
        }));
        await model.save();

        await flow.confirmPayment();

        // Back on the seats step: the taken seat is no longer selected there, so another one is chosen
        const seatsView = page.getByTestId('bulk-seats-view');
        await expect(seatsView).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('order-view')).toHaveCount(0);
        await expect(seatsView.getByTestId('confirm-seats-button')).toBeDisabled();
        await flow.chooseBulkSeats('Voorstelling', 1);

        // The details are kept: the order below still has the meal choice
        await flow.submitDetails();
        await page.getByTestId('customer-step').getByTestId('save-button').click();
        await flow.confirmPayment();
        await flow.expectTicketsDownloadable();

        const orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        expect(orders[0].data.cart.items[0].seats.map(s => s.row + s.seat)).toEqual(['A2']);
        expect(orders[0].data.cart.items[0].options[0].option.name).toBe('Vegetarisch');
    });

    test('Stays on the seats step when a seat got taken before confirming it, without a details step', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: true });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Bulk seat taken ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            orderMode: WebshopOrderMode.Bulk,
            withSeatingPlan: true,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: ({ seatingPlanId }) => [
                Product.create({
                    name: 'Voorstelling',
                    type: ProductType.Ticket,
                    prices: [ProductPrice.create({ name: 'Standaard', price: 10_00_00 })],
                    seatingPlanId,
                }),
            ],
        });

        const flow = new WebshopOrderFlow(page, { orderMode: WebshopOrderMode.Bulk });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await expect(flow.bulkAmount('Voorstelling')).toHaveValue('1');
        await flow.startBulkOrder();

        const seatsView = page.getByTestId('bulk-seats-view');
        await expect(seatsView).toBeVisible({ timeout: 15000 });
        await seatsView.getByTestId('seat-button').first().click();

        // Someone else takes the selected seat (A1) before the visitor confirms it
        const seatingPlan = TestWebshops.seatingPlanOf(webshop);
        const model = (await Webshop.getByID(webshop.id))!;
        model.products[0].reservedSeats.push(ReservedSeat.create({
            section: seatingPlan.sections[0].id,
            row: seatingPlan.sections[0].rows[0].label,
            seat: seatingPlan.sections[0].rows[0].seats[0].label,
        }));
        await model.save();

        // There is no details step that checks the seats later: the seats step itself does, before the contact details
        await seatsView.getByTestId('confirm-seats-button').click();
        await expect(seatsView.locator('.error-box').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('customer-step')).toHaveCount(0);
        await expect(seatsView.getByTestId('confirm-seats-button')).toBeDisabled();

        await seatsView.getByTestId('seat-button').nth(1).click();
        await seatsView.getByTestId('confirm-seats-button').click();
        await flow.fillCustomer();
        await flow.confirmPayment();
        await flow.expectTicketsDownloadable();

        const orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        expect(orders[0].data.cart.items[0].seats.map(s => s.row + s.seat)).toEqual(['A2']);
    });

    test('Has a seats step per seated product in the checkout progress and resumes the details step after a reload', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: true });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Bulk two plans ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            orderMode: WebshopOrderMode.Bulk,
            withSeatingPlan: true,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: ({ seatingPlanId }) => [
                Product.create({
                    name: 'Voorstelling',
                    type: ProductType.Ticket,
                    prices: [ProductPrice.create({ name: 'Standaard', price: 10_00_00 })],
                    seatingPlanId,
                }),
                Product.create({
                    name: 'Nabespreking',
                    type: ProductType.Ticket,
                    prices: [ProductPrice.create({ name: 'Standaard', price: 5_00_00 })],
                    seatingPlanId,
                    optionMenus: [mealMenu()],
                }),
            ],
        });

        const flow = new WebshopOrderFlow(page, { orderMode: WebshopOrderMode.Bulk });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.setBulkAmount('Voorstelling', 1);
        await flow.setBulkAmount('Nabespreking', 1);
        await flow.startBulkOrder();

        // With two seated products, the seats steps are named after the product
        const progress = page.getByTestId('checkout-progress');
        await expect(progress.locator('.titles .title')).toHaveText(['Keuze', 'Voorstelling', 'Nabespreking', 'Tickets', 'Contactgegevens', 'Betalen']);
        await flow.chooseBulkSeats('Voorstelling', 1);
        await flow.chooseBulkSeats('Nabespreking', 1);
        await expect(flow.detailsStep()).toBeVisible();
        await page.waitForURL(/\/checkout\/details$/);

        await page.reload();
        await expect(flow.detailsStep()).toBeVisible({ timeout: 15000 });
        await expect(progress.locator('[aria-current="step"] .title')).toHaveText('Tickets');

        // The steps before it are recreated: back to the first seats step, which kept its seat
        await progress.getByRole('button', { name: 'Voorstelling' }).click();
        const seatsView = page.getByTestId('bulk-seats-view');
        await expect(seatsView).toContainText('Voorstelling');
        await seatsView.getByTestId('confirm-seats-button').click();
        await expect(seatsView).toContainText('Nabespreking');
        await seatsView.getByTestId('confirm-seats-button').click();

        await flow.fillDetails(0, { option: 'Vegetarisch' });
        await flow.submitDetails();
        await flow.fillCustomer();
        await flow.confirmPayment();
        await flow.expectTicketsDownloadable();

        const orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        expect(orders[0].data.cart.items.map(i => i.product.name + ':' + i.seats.length).sort()).toEqual(['Nabespreking:1', 'Voorstelling:1']);
    });

    test('Keeps the units that are still in stock when the stock drops during the checkout', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: true });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Bulk stock ${WorkerData.id}`,
            orderMode: WebshopOrderMode.Bulk,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: () => [
                Product.create({
                    name: 'Workshop',
                    stock: 3,
                    prices: [ProductPrice.create({ name: 'Standaard', price: 5_00_00 })],
                    optionMenus: [mealMenu()],
                }),
            ],
        });

        const flow = new WebshopOrderFlow(page, { orderMode: WebshopOrderMode.Bulk });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        // One unit is preselected: 3 in total
        await flow.setBulkAmount('Workshop', 2);
        await flow.startBulkOrder();
        for (const index of [0, 1, 2]) {
            await flow.fillDetails(index, { option: 'Vegetarisch' });
        }
        await flow.submitDetails();
        await flow.fillCustomer();

        // Someone else buys one while this visitor is at the payment step: 2 of the 3 units are left
        const model = (await Webshop.getByID(webshop.id))!;
        model.products[0].usedStock = 1;
        await model.save();
        await flow.confirmPayment();

        // Back on the details step: the first two units and their details are kept
        await expect(flow.detailsStep()).toBeVisible({ timeout: 15000 });
        await expect(flow.detailsStep().getByTestId('details-item')).toHaveCount(2);
        await flow.submitDetails();
        await page.getByTestId('customer-step').getByTestId('save-button').click();
        await flow.confirmPayment();
        await flow.expectOrderConfirmed();

        const orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        // Both units have the same choices: one item in the order
        expect(orders[0].data.cart.items).toHaveLength(1);
        expect(orders[0].data.cart.items[0].amount).toBe(2);
        expect(orders[0].data.cart.items[0].options[0].option.name).toBe('Vegetarisch');
    });

    test('Shows the name error when a participant is left without a name', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: true });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Bulk missing name ${WorkerData.id}`,
            orderMode: WebshopOrderMode.Bulk,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: () => [
                Product.create({
                    name: 'Deelname',
                    enableCustomer: true,
                    prices: [ProductPrice.create({ name: 'Standaard', price: 5_00_00 })],
                }),
            ],
        });

        const flow = new WebshopOrderFlow(page, { orderMode: WebshopOrderMode.Bulk });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.startBulkOrder();
        await expect(flow.detailsItem(0)).toBeVisible({ timeout: 15000 });
        await flow.submitDetails();

        // The validation error is shown at the name input instead of blocking the step
        await expect(flow.detailsItem(0).getByText('De voornaam die je hebt opgegeven is ongeldig', { exact: false })).toBeVisible();

        await flow.fillDetails(0, { customer: { firstName: 'Jane', lastName: 'Doe' } });
        await flow.submitDetails();

        // The only participant is the contact person: only the email is left to ask
        const step = page.getByTestId('customer-step');
        await step.locator('input[name="email"]').fill('jane@test.be');
        await step.getByTestId('save-button').click();
        await flow.confirmPayment();
        await flow.expectOrderConfirmed();

        const orders = await fetchOrders(webshop.id);
        expect(orders[0].data.cart.items[0].customer?.name).toBe('Jane Doe');
    });

    test('Keeps the option of a unit selected when an option is chosen for another unit', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: true });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Bulk options ${WorkerData.id}`,
            orderMode: WebshopOrderMode.Bulk,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: () => [
                Product.create({
                    name: 'Workshop',
                    prices: [ProductPrice.create({ name: 'Standaard', price: 5_00_00 })],
                    optionMenus: [mealMenu()],
                }),
            ],
        });

        const flow = new WebshopOrderFlow(page, { orderMode: WebshopOrderMode.Bulk });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        // One unit is preselected: 2 in total
        await flow.setBulkAmount('Workshop', 1);
        await flow.startBulkOrder();
        await flow.fillDetails(0, { option: 'Vegetarisch' });
        await flow.fillDetails(1, { option: 'Vlees' });

        // Every unit has its own radio group: the choice of the first unit stays visible
        await expect(flow.detailsItem(0).locator('label').filter({ hasText: 'Vegetarisch' }).locator('input[type="radio"]')).toBeChecked();
        await expect(flow.detailsItem(1).locator('label').filter({ hasText: 'Vlees' }).locator('input[type="radio"]')).toBeChecked();
    });

    test('Applies a discount code entered in the payment step', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: true });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Bulk discount ${WorkerData.id}`,
            orderMode: WebshopOrderMode.Bulk,
            productCount: 1,
            paymentMethods: [PaymentMethod.PointOfSale],
        });
        webshop.meta.allowDiscountCodeEntry = true;
        await webshop.save();

        const code = new WebshopDiscountCode();
        code.organizationId = organization.id;
        code.webshopId = webshop.id;
        code.code = 'BULK5';
        code.discounts = [Discount.create({ orderDiscount: GeneralDiscount.create({ fixedDiscount: 5_0000 }) })];
        await code.save();

        const flow = new WebshopOrderFlow(page, { orderMode: WebshopOrderMode.Bulk });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await expect(flow.bulkAmount('Product 1')).toHaveValue('1');

        // The bulk order mode has no cart: codes are entered next to the payment methods
        await expect(page.getByRole('button', { name: 'Kortingscode inwisselen' })).toHaveCount(0);

        await flow.startBulkOrder();
        await flow.fillCustomer();
        await expect(page.getByTestId('payment-step')).toBeVisible({ timeout: 15000 });

        const preview = page.getByTestId('cart-preview');
        await preview.getByRole('button', { name: 'Kortingscode inwisselen' }).click();
        await preview.getByPlaceholder('Vul hier je kortingscode in').fill('BULK5');
        await preview.getByRole('button', { name: 'Inwisselen', exact: true }).click();
        await expect(preview.locator('.discount-box')).toContainText('BULK5');
        await expect(preview).toContainText('€ 10');

        await flow.confirmPayment();
        await flow.expectOrderConfirmed();

        const orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        expect(orders[0].data.totalPrice).toBe(15_0000 - 5_0000);
    });

    test('The order button sticks to the bottom of a small screen once a unit is chosen', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const organization = await createOrganization({ modernWebshop: true });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Bulk sticky ${WorkerData.id}`,
            orderMode: WebshopOrderMode.Bulk,
            productCount: 15,
            paymentMethods: [PaymentMethod.PointOfSale],
        });

        const flow = new WebshopOrderFlow(page, { orderMode: WebshopOrderMode.Bulk });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        const orderButton = page.getByTestId('bulk-order-button');
        const footer = page.locator('.webshop-platform-footer');
        // Position of the platform footer relative to the top of the products: independent of the scroll position
        const footerTop = () => footer.evaluate(el => el.getBoundingClientRect().top - document.querySelector('.webshop-products')!.getBoundingClientRect().top);

        // Without units the button stays below the long list
        await expect(flow.bulkAmount('Product 1')).toBeInViewport();
        await expect(orderButton).not.toBeInViewport();
        const footerTopWithoutUnits = await footerTop();

        // The first unit brings the button within reach, like the cart button of a webshop with a cart
        await flow.setBulkAmount('Product 1', 1);
        await expect(flow.bulkAmount('Product 1')).toBeInViewport();
        await expect(orderButton).toBeInViewport();
        // The products that scroll below the stuck button are hidden up to the bottom of the screen
        const coveredAtBottom = await page.evaluate(() => !!document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 1)?.closest('.bulk-order-bar'));
        expect(coveredAtBottom).toBe(true);
        // Sticking keeps the spacing below the button, so the footer does not move
        expect(await footerTop()).toBe(footerTopWithoutUnits);

        // At the end of the page, the space below the button covers nothing after the products, also with a safe area at the bottom of the screen (iPhone)
        await page.evaluate(() => document.body.classList.add('debug-safe-area'));
        await footer.evaluate(el => el.closest('main')!.scrollTo({ top: el.closest('main')!.scrollHeight }));
        const coverage = await footer.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const covered = (y: number) => !!document.elementFromPoint(rect.left + rect.width / 2, y)?.closest('.bulk-order-bar');
            return { footer: covered(rect.top + rect.height / 2), belowFooter: covered(rect.bottom + 5), belowFooterVisible: rect.bottom + 5 < window.innerHeight };
        });
        expect(coverage).toEqual({ footer: false, belowFooter: false, belowFooterVisible: true });

        await flow.typeBulkAmount('Product 1', 0);
        await expect(flow.bulkAmount('Product 1')).toHaveValue('');
        await expect(orderButton).not.toBeInViewport();
    });

    test('The order mode can be changed in the dashboard', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: true });
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Bulk settings ${WorkerData.id}`,
            productCount: 2,
            cartEnabled: true,
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

        await expect(page.getByTestId('order-mode-cart').locator('input')).toBeChecked();
        await page.getByTestId('order-mode-bulk').click();
        await page.locator('.st-view').last().getByTestId('save-button').click();

        await expect.poll(async () => (await Webshop.getByID(webshop.id))!.meta.orderMode).toBe(WebshopOrderMode.Bulk);
    });
});
