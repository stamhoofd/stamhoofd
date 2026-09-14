// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import type { User } from '@stamhoofd/models';
import { Order, Organization, OrganizationFactory, UserFactory, Webshop } from '@stamhoofd/models';
import { Option, OptionMenu, PaymentMethod, PermissionLevel, Permissions, Product, ProductPrice, ProductType, ReservedSeat, STPackageBundle, Token as TokenStruct, Version, WebshopField, WebshopOrderMode, WebshopTicketType } from '@stamhoofd/structures';
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
        const items = orders[0].data.cart.items;
        expect(items).toHaveLength(3);
        expect(items.every(i => i.amount === 1)).toBe(true);
        expect(items.filter(i => i.product.name === 'Voorstelling').flatMap(i => i.seats)).toHaveLength(2);
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

    test('Shows a seat that got taken in the meantime on the affected ticket in the details step', async ({ page }) => {
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

        // Back on the details step, with the error on the affected ticket
        await expect(flow.detailsStep()).toBeVisible({ timeout: 15000 });
        await expect(flow.detailsItem(0).locator('.error-box')).toBeVisible();
        await expect(page.getByTestId('order-view')).toHaveCount(0);
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
        expect((await Webshop.getByID(webshop.id))!.meta.cartEnabled).toBe(false);
    });
});
