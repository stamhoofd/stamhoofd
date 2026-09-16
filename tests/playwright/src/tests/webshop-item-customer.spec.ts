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
import { PaymentMethod, PermissionLevel, Permissions, Product, ProductPrice, STPackageBundle, Token as TokenStruct, Version } from '@stamhoofd/structures';
import { CustomerFieldRequirement } from '@stamhoofd/structures/webshops/CustomerFieldRequirement.js';
import { TestUtils } from '@stamhoofd/test-utils';
import { WebshopOrderFlow } from '../flows/WebshopOrderFlow.js';
import { DashboardPage, DashboardTab, WorkerData } from '../helpers/index.js';
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

    test('Collects a customer per item in the classic cart flow', async ({ page }) => {
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
        await expect(page.locator('.cart-item-row')).toHaveCount(2);

        await flow.goToCheckout();
        await flow.selectMainCustomer('Jane Doe');
        await flow.fillCustomer({ firstName: 'Jane', lastName: 'Doe', email: 'jane@test.be' });
        await flow.confirmPayment();
        await flow.expectOrderConfirmed();

        const orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        expect(orders[0].data.cart.items.map(i => i.customer?.name)).toEqual(['Jane Doe', 'Jack Doe']);
        expect(orders[0].data.cart.items.every(i => i.amount === 1)).toBe(true);
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
        await page.getByTestId('customer-field-email').selectOption(CustomerFieldRequirement.Required);

        // The participant record category is unboxed: no title input
        await page.getByTestId('edit-customer-record-category').click();
        const categoryEditor = page.locator('.st-view').last();
        await expect(categoryEditor.getByRole('heading', { name: 'Extra vragen', exact: true }).first()).toBeVisible();
        await expect(categoryEditor.locator('input[placeholder="Titel"]')).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('enable-customer-checkbox')).toBeVisible();

        // Save the product, then the webshop
        await page.locator('.st-view').last().getByTestId('save-button').click();
        await expect(page.getByTestId('enable-customer-checkbox')).toHaveCount(0);
        await page.locator('.st-view').last().getByTestId('save-button').click();

        await expect.poll(async () => (await Webshop.getByID(webshop.id))!.products[0].enableCustomer).toBe(true);
        expect((await Webshop.getByID(webshop.id))!.products[0].customerSettings?.email).toBe(CustomerFieldRequirement.Required);
    });
});
