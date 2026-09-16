// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { Order, Organization, OrganizationFactory, Platform } from '@stamhoofd/models';
import { PaymentMethod, STPackageBundle } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WebshopOrderFlow } from '../flows/WebshopOrderFlow.js';
import { WorkerData } from '../helpers/index.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

let organizationCounter = 0;

async function createOrganization() {
    organizationCounter += 1;
    const organization = await new OrganizationFactory({
        name: `ModernShop${WorkerData.id}-${Date.now()}-${organizationCounter}`,
        packages: [STPackageBundle.Webshops],
    }).create();

    // Recalculate meta.packages so the public webshop is not rendered as "closed"
    await STPackageService.updateOrganizationPackages(organization.id);
    return (await Organization.getByID(organization.id))!;
}

/**
 * The public webshop only sees platform feature flags, not the organization's
 */
async function setPlatformFeatureFlags(featureFlags: string[]) {
    const platform = await Platform.getForEditing();
    platform.config.featureFlags = featureFlags;
    await platform.save();
}

async function fetchOrders(webshopId: string) {
    return await Order.select().where('webshopId', webshopId).fetch();
}

test.describe('Modern webshop view @webshop-modern', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    // The platform is shared by every test of this worker: reset the flag so classic-view tests keep the classic view
    test.beforeEach(async () => {
        await setPlatformFeatureFlags(['modern-webshop']);
    });

    test.afterEach(async () => {
        await setPlatformFeatureFlags([]);
    });

    test('Orders from the cart on the webshop page itself', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Modern cart ${WorkerData.id}`,
            productCount: 2,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.PointOfSale],
        });

        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await expect(page.locator('.modern-webshop-view')).toBeVisible();

        await flow.addProduct('Product 1');
        await flow.addProduct('Product 2', { count: 2 });

        // The cart is pushed on the page itself; the cart button in the bar reopens it
        await page.getByTestId('cart-add-more-button').click();
        await expect(page.getByTestId('cart-button')).toContainText('3');
        await page.getByTestId('cart-button').click();
        await expect(page.locator('.cart-item-row')).toHaveCount(2);

        await flow.goToCheckout();
        await flow.fillCustomer();
        await flow.confirmPayment();
        await flow.expectOrderConfirmed();

        const orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        expect(orders[0].data.cart.items.map(i => i.amount)).toEqual([1, 2]);
    });

    test('Orders a single product without a cart', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Modern single ${WorkerData.id}`,
            productCount: 1,
            cartEnabled: false,
            paymentMethods: [PaymentMethod.PointOfSale],
        });

        const flow = new WebshopOrderFlow(page, { cartEnabled: false });
        await page.goto(WorkerData.urls.webshopUri(webshop.uri));

        // One product and no cart: the page has a single order button instead of a product list
        const orderButton = page.getByTestId('single-order-button');
        await expect(orderButton).toBeVisible({ timeout: 15000 });
        await orderButton.click();
        const cartItemView = page.getByTestId('cart-item-view');
        await expect(cartItemView).toBeVisible();
        await cartItemView.getByTestId('save-button').click();

        await flow.goToCheckout();
        await flow.fillCustomer();
        await flow.confirmPayment();
        await flow.expectOrderConfirmed();

        const orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        expect(orders[0].data.cart.items).toHaveLength(1);
    });
});
