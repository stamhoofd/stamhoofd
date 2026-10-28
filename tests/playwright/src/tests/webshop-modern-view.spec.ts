// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { Order, Organization, OrganizationFactory } from '@stamhoofd/models';
import { File, Image, PaymentMethod, Product, ProductPrice, RichText, STPackageBundle, WebshopLayout, WebshopTicketType } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
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
 * Wait until the navigation transition of the webshop is done: the navigation controller keeps the leaving view
 * next to the entering one until the transition ends.
 */
async function waitForNavigationTransition(page: Page) {
    await page.waitForFunction(() => document.querySelector('.webshop-controller-main .navigation-controller')?.children.length === 1);
}

async function fetchOrders(webshopId: string) {
    return await Order.select().where('webshopId', webshopId).fetch();
}

test.describe('Modern webshop view @webshop-modern', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
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

        // Adding stays on the webshop page; the toast opens the cart, which is pushed on the page itself
        await expect(page.getByTestId('cart-button')).toContainText('3');
        await page.getByTestId('cart-added-toast').first().getByRole('button', { name: 'Bekijk winkelmandje' }).click();
        await expect(page.locator('.cart-item-row')).toHaveCount(2);

        await flow.goToCheckout();
        await flow.fillCustomer();
        await flow.confirmPayment();
        await flow.expectOrderConfirmed();

        const orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        expect(orders[0].data.cart.items.map(i => i.amount)).toEqual([1, 2]);
    });

    test('Returns to the cart from the checkout with the cart step in the progress', async ({ page }) => {
        // On small screens the progress only shows the step number
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Modern back to cart ${WorkerData.id}`,
            productCount: 2,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.PointOfSale],
        });

        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.addProduct('Product 1');
        await flow.goToCheckout();
        await flow.fillCustomer();
        await expect(page.getByTestId('payment-step')).toBeVisible({ timeout: 15000 });

        await page.getByTestId('checkout-progress').getByRole('button', { name: 'Winkelmandje' }).click();
        await expect(page.getByTestId('payment-step')).toHaveCount(0);
        await expect(page.getByTestId('customer-step')).toHaveCount(0);
        await expect(page.getByTestId('cart-checkout-button')).toBeVisible();
        await expect(page.locator('.cart-item-row')).toHaveCount(1);
    });

    test('Shows the checkout progress in the cart and checkout steps', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Modern progress ${WorkerData.id}`,
            productCount: 2,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.PointOfSale],
            deliveryCountries: [Country.France],
        });

        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        const progress = page.getByTestId('checkout-progress');
        await expect(progress).toHaveCount(0);

        await flow.addProduct('Product 1');
        await flow.openCart();
        const steps = progress.locator('.titles .title');
        const current = progress.locator('[aria-current="step"] .title');
        await expect(steps).toHaveText(['Winkelmandje', 'Leveringsadres', 'Gegevens', 'Betalen']);
        await expect(current).toHaveText('Winkelmandje');
        await expect(progress.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');

        // The next step continues like the button of the view: the address is validated first
        await progress.getByRole('button', { name: 'Leveringsadres' }).click();
        await expect(page.getByTestId('address-step')).toBeVisible();
        await expect(current).toHaveText('Leveringsadres');
        await progress.getByRole('button', { name: 'Gegevens' }).click();
        await expect(page.getByTestId('address-step').locator('.error-box').first()).toBeVisible();
        await expect(page.getByTestId('customer-step')).toHaveCount(0);

        await progress.getByRole('button', { name: 'Winkelmandje' }).click();
        await expect(page.getByTestId('address-step')).toHaveCount(0);
        await flow.fillDeliveryAddressStep({ street: 'Rue de Test', number: '10', postalCode: '75001', city: 'Paris', country: Country.France });
        await expect(current).toHaveText('Gegevens');
        // Previous steps and the next step can be clicked, later steps not
        await expect(progress.getByRole('button').locator('.title')).toHaveText(['Winkelmandje', 'Leveringsadres', 'Betalen']);

        // Not all titles fit on small screens: only the step number
        await page.setViewportSize({ width: 360, height: 700 });
        await expect(page.getByTestId('checkout-progress-compact')).toHaveText('Stap 3 van 4');
        await expect(progress).toBeInViewport();

        await page.setViewportSize({ width: 1280, height: 800 });
        await expect(page.getByTestId('checkout-progress-compact')).toHaveCount(0);

        // Back to a previous step
        await progress.getByRole('button', { name: 'Leveringsadres' }).click();
        await expect(page.getByTestId('address-step')).toBeVisible();
        await expect(page.getByTestId('customer-step')).toHaveCount(0);
        await expect(current).toHaveText('Leveringsadres');
        await progress.getByRole('button', { name: 'Gegevens' }).click();
        await expect(page.getByTestId('customer-step')).toBeVisible();

        await flow.fillCustomer();
        await expect(page.getByTestId('payment-step')).toBeVisible({ timeout: 15000 });
        await expect(current).toHaveText('Betalen');
        await expect(progress.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');

        await flow.confirmPayment();
        await flow.expectOrderConfirmed();
        await expect(progress).toHaveCount(0);
    });

    test('Shows the cart below the progress bar when returning to it after a reload', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Modern progress reload ${WorkerData.id}`,
            productCount: 2,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.PointOfSale],
        });

        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.addProduct('Product 1');
        await flow.goToCheckout();
        await flow.fillCustomer();
        await expect(page.getByTestId('payment-step')).toBeVisible({ timeout: 15000 });

        // The reload restores the cart below the steps. A slow cart chunk must never leave a loading view in its place.
        await page.route('**/CartView-*.js', async (route) => {
            await new Promise(resolve => setTimeout(resolve, 1000));
            await route.continue();
        });
        await page.reload();
        await expect(page.getByTestId('customer-step').or(page.getByTestId('payment-step'))).toBeVisible({ timeout: 15000 });

        // Every frame: every view below the progress bar (also the loading view of the cart) has the same top inset
        type SampleWindow = { insets: string[]; stopSamples: boolean };
        await page.evaluate(() => {
            const w = window as unknown as SampleWindow;
            w.insets = [];
            w.stopSamples = false;
            const sample = () => {
                for (const wrapper of document.querySelectorAll('.webshop-controller-main .navigation-controller > div')) {
                    if (!wrapper.querySelector('.modern-webshop-view')) {
                        w.insets.push(getComputedStyle(wrapper).getPropertyValue('--st-safe-area-top'));
                    }
                }
                if (!w.stopSamples) {
                    requestAnimationFrame(sample);
                }
            };
            requestAnimationFrame(sample);
        });

        await page.getByTestId('checkout-progress').getByRole('button', { name: 'Winkelmandje' }).click();
        await expect(page.getByTestId('cart-checkout-button')).toBeVisible();
        await waitForNavigationTransition(page);

        const insets = await page.evaluate(() => {
            const w = window as unknown as SampleWindow;
            w.stopSamples = true;
            return w.insets;
        });
        expect(insets.length).toBeGreaterThan(0);
        expect(new Set(insets).size).toBe(1);

        const progressBottom = (await page.getByTestId('checkout-progress').boundingBox())!;
        const cartTitle = (await page.locator('.cart-view main h1').boundingBox())!;
        expect(cartTitle.y).toBeGreaterThanOrEqual(progressBottom.y + progressBottom.height);
    });

    test('Keeps the webshop bar above the views while the cart opens', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Modern bar ${WorkerData.id}`,
            productCount: 2,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.PointOfSale],
        });

        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.addProduct('Product 1');

        // Sample the top of the screen on every frame: the loading view of the cart must never cover the bar
        type SampleWindow = { barSamples: boolean[]; stopBarSamples: boolean };
        await page.evaluate(() => {
            const w = window as unknown as SampleWindow;
            w.barSamples = [];
            w.stopBarSamples = false;
            const sample = () => {
                w.barSamples.push(!!document.elementFromPoint(5, 5)?.closest('.webshop-controller-bar'));
                if (!w.stopBarSamples) {
                    requestAnimationFrame(sample);
                }
            };
            requestAnimationFrame(sample);
        });

        await page.getByTestId('cart-button').click();
        await expect(page.locator('.cart-item-row')).toHaveCount(1);
        await waitForNavigationTransition(page);

        const samples = await page.evaluate(() => {
            const w = window as unknown as SampleWindow;
            w.stopBarSamples = true;
            return w.barSamples;
        });
        expect(samples.length).toBeGreaterThan(0);
        expect(samples.filter(onTop => !onTop)).toHaveLength(0);
    });

    test('Keeps the webshop bar without cart button above the order on small screens', async ({ page }) => {
        // Other pushed views slide the bar away on small screens
        await page.setViewportSize({ width: 390, height: 844 });
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Modern order bar ${WorkerData.id}`,
            productCount: 2,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.PointOfSale],
        });

        const bar = page.locator('.webshop-controller-bar');
        const websiteLink = page.getByTestId('website-link');
        const backToWebshop = page.getByTestId('back-to-webshop-button');
        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await expect(websiteLink).toBeVisible();
        await flow.addProduct('Product 1');
        await flow.goToCheckout();
        // The bar shows the checkout progress instead of the logo
        await expect(page.getByTestId('checkout-progress')).toBeInViewport();
        await expect(websiteLink).toHaveCount(0);
        await flow.fillCustomer();
        await flow.confirmPayment();
        await flow.expectOrderConfirmed();

        await expect(bar).toBeInViewport();
        await expect(page.getByTestId('cart-button')).toHaveCount(0);
        // The order replaces the website link with a link back to the webshop
        await expect(websiteLink).toHaveCount(0);
        await expect(backToWebshop).toBeVisible();

        // Back to the webshop: the cart button returns
        await page.goBack();
        await expect(page.locator('.modern-webshop-view')).toBeVisible();
        await expect(page.getByTestId('order-view')).toHaveCount(0);
        await expect(page.getByTestId('cart-button')).toBeVisible();

        // The link in the confirmation email
        const [order] = await fetchOrders(webshop.id);
        await page.goto(WorkerData.urls.webshopUri(webshop.uri) + '/order/' + order.id);
        await flow.expectOrderConfirmed();
        await expect(bar).toBeInViewport();
        await expect(page.getByTestId('cart-button')).toHaveCount(0);

        await backToWebshop.click();
        await expect(page.locator('.modern-webshop-view')).toBeVisible();
        await expect(page.getByTestId('order-view')).toHaveCount(0);
        await expect(websiteLink).toBeVisible();
    });

    test('Shows the product form on the page when a single product webshop has no description', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Modern inline ${WorkerData.id}`,
            cartEnabled: false,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: () => [Product.create({
                name: 'Inkomticket',
                description: 'Toegang tot het hele weekend',
                prices: [ProductPrice.create({ price: 1500 })],
                // Like the existing webshops that order one at a time: the amount can still be chosen
                allowMultiple: true,
            })],
        });
        // A description that was cleared in the editor leaves empty html behind
        webshop.meta.description = RichText.create({ text: '\n', html: '<p></p><p></p>' });
        await webshop.save();

        const flow = new WebshopOrderFlow(page, { cartEnabled: false });
        await page.goto(WorkerData.urls.webshopUri(webshop.uri));

        // The form replaces the order button and shows the description of the product, but not its name: the page
        // already has the title of the webshop.
        // In the stacked layout, the form is shown below the content.
        const view = page.locator('.modern-webshop');
        const form = view.getByTestId('cart-item-view');
        await expect(form).toBeVisible({ timeout: 15000 });
        await expect(view.getByTestId('single-order-button')).toHaveCount(0);
        await expect(view.getByRole('heading', { level: 1 })).toHaveText(`Modern inline ${WorkerData.id}`);
        await expect(form).toContainText('Toegang tot het hele weekend');
        await expect(form.getByRole('heading', { name: 'Inkomticket' })).toHaveCount(0);

        // Changes are saved right away, so they survive a reload
        const amountInput = form.getByTestId('amount-number-input').locator('input');
        await amountInput.fill('2');
        await amountInput.press('Tab');
        await page.reload();
        await expect(amountInput).toHaveValue(/^2/, { timeout: 15000 });
        await form.getByTestId('save-button').click();

        await flow.goToCheckout();
        await flow.fillCustomer();
        await flow.confirmPayment();
        await flow.expectOrderConfirmed();

        const orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        expect(orders[0].data.cart.items.map(i => i.amount)).toEqual([2]);
    });

    test('Continues to the checkout from the product form of a free webshop', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Modern free ${WorkerData.id}`,
            cartEnabled: false,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: () => [Product.create({
                name: 'Ticketje',
                prices: [ProductPrice.create({ name: 'Volwassen', price: 0 }), ProductPrice.create({ name: 'Kind', price: 0 })],
            })],
        });

        await page.goto(WorkerData.urls.webshopUri(webshop.uri));
        const form = page.locator('.modern-webshop').getByTestId('cart-item-view');
        await expect(form).toBeVisible({ timeout: 15000 });
        await form.getByTestId('save-button').click();

        await expect(page.getByTestId('customer-step')).toBeVisible({ timeout: 15000 });
        // Without a cart there is no cart step, and nothing to pay
        await expect(page.getByTestId('checkout-progress').locator('.titles .title')).toHaveText(['Gegevens', 'Nakijken']);
        const flow = new WebshopOrderFlow(page, { cartEnabled: false });
        await flow.fillCustomer();
        await flow.confirmPayment();
        await flow.expectOrderConfirmed();

        // A second order from the same page, without reloading
        await page.goBack();
        await expect(form).toBeVisible({ timeout: 15000 });
        await form.getByTestId('save-button').click();
        await expect(page.getByTestId('customer-step')).toBeVisible({ timeout: 15000 });
        await page.getByTestId('customer-step').getByTestId('save-button').click();
        await flow.confirmPayment();
        await flow.expectOrderConfirmed();
        await expect(page.locator('.error-box')).toHaveCount(0);
        expect(await fetchOrders(webshop.id)).toHaveLength(2);
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
        webshop.meta.description = RichText.create({ text: 'Alle info over deze actie', html: '<p>Alle info over deze actie</p>' });
        webshop.products[0].description = 'Info over het product';
        await webshop.save();

        const flow = new WebshopOrderFlow(page, { cartEnabled: false });
        await page.goto(WorkerData.urls.webshopUri(webshop.uri));

        // One product, no cart and two descriptions: the page has a single order button instead of a product list
        const orderButton = page.getByTestId('single-order-button');
        await expect(orderButton).toBeVisible({ timeout: 15000 });
        await orderButton.click();
        const cartItemView = page.getByTestId('cart-item-view');
        await expect(cartItemView).toBeVisible();

        // Changes are saved right away: closing does not ask to discard them, and reopening shows them again
        const amountInput = cartItemView.getByTestId('amount-number-input').locator('input');
        await amountInput.fill('3');
        await amountInput.press('Tab');
        await page.goBack();
        await expect(cartItemView).toBeHidden();
        await orderButton.click();
        await expect(amountInput).toHaveValue(/^3/);
        await cartItemView.getByTestId('save-button').click();

        await flow.goToCheckout();
        await flow.fillCustomer();
        await flow.confirmPayment();
        await flow.expectOrderConfirmed();

        const orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        expect(orders[0].data.cart.items.map(i => i.amount)).toEqual([3]);
    });

    test('Closes the seat selection when continuing from a single seated product', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Modern single seats ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            productCount: 1,
            cartEnabled: false,
            withSeatingPlan: true,
            paymentMethods: [PaymentMethod.PointOfSale],
        });
        webshop.meta.description = RichText.create({ text: 'Alle info over deze voorstelling', html: '<p>Alle info over deze voorstelling</p>' });
        webshop.products[0].description = 'Info over de voorstelling';
        await webshop.save();

        const flow = new WebshopOrderFlow(page, { cartEnabled: false });
        await page.goto(WorkerData.urls.webshopUri(webshop.uri));

        await page.getByTestId('single-order-button').click();
        await page.getByTestId('cart-item-view').getByTestId('save-button').click();

        const seatsView = page.getByTestId('choose-seats-view');
        await expect(seatsView).toBeVisible();
        await seatsView.getByTestId('seat-button').first().click();
        await seatsView.getByTestId('confirm-seats-button').click();
        await expect(seatsView).toBeHidden();

        await flow.fillCustomer();
        await flow.confirmPayment();
        await flow.expectOrderConfirmed();

        const orders = await fetchOrders(webshop.id);
        expect(orders).toHaveLength(1);
        expect(orders[0].data.cart.items[0].seats).toHaveLength(1);
    });

    test('Shows the products next to the content in the split layout', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Modern split ${WorkerData.id}`,
            productCount: 2,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.PointOfSale],
        });
        webshop.meta.layout = WebshopLayout.Split;
        webshop.meta.description = RichText.create({ text: 'Alle info over deze actie', html: '<p>Alle info over deze actie</p>' });
        await webshop.save();

        await page.goto(WorkerData.urls.webshopUri(webshop.uri));
        const column = page.locator('.preview-panel-column');
        await expect(column.getByTestId('product-box')).toHaveCount(2, { timeout: 15000 });
        await expect(page.locator('.modern-webshop-view').getByText('Alle info over deze actie')).toBeVisible();
        // Without a custom title: the default title for what the webshop sells
        await expect(column.getByRole('heading', { level: 2, name: 'Artikelen' })).toBeVisible();

        // On small screens the products move below the content
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(column).toBeHidden();
        await expect(page.locator('.modern-webshop-view').getByTestId('product-box')).toHaveCount(2);
        await expect(page.getByRole('heading', { level: 2, name: 'Artikelen' })).toHaveCount(0);
    });

    test('Shows the product form next to the description in the split layout', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Modern split single ${WorkerData.id}`,
            productCount: 1,
            cartEnabled: false,
            paymentMethods: [PaymentMethod.PointOfSale],
        });
        webshop.meta.layout = WebshopLayout.Split;
        webshop.meta.orderTitle = 'Koop hier je ticket';
        webshop.meta.description = RichText.create({ text: 'Alle info over deze actie', html: '<p>Alle info over deze actie</p>' });
        await webshop.save();

        await page.goto(WorkerData.urls.webshopUri(webshop.uri));
        await expect(page.locator('.preview-panel-column').getByTestId('cart-item-view')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('single-order-button')).toHaveCount(0);
        await expect(page.locator('.modern-webshop-view').getByText('Alle info over deze actie')).toBeVisible();
        await expect(page.locator('.preview-panel-column').getByRole('heading', { level: 2, name: 'Koop hier je ticket' })).toBeVisible();

        // Below the content, the form follows the title of the webshop without a title of its own
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(page.getByTestId('cart-item-view')).toBeVisible();
        await expect(page.getByRole('heading', { level: 2, name: 'Koop hier je ticket' })).toHaveCount(0);
    });

    test('Keeps the order button below the description in the stacked layout', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Modern stacked ${WorkerData.id}`,
            productCount: 1,
            cartEnabled: false,
            paymentMethods: [PaymentMethod.PointOfSale],
        });
        webshop.meta.description = RichText.create({ text: 'Alle info over deze actie', html: '<p>Alle info over deze actie</p>' });
        webshop.products[0].description = 'Info over het product';
        await webshop.save();

        await page.goto(WorkerData.urls.webshopUri(webshop.uri));
        await expect(page.locator('.modern-webshop-view').getByTestId('single-order-button')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('cart-item-view')).toHaveCount(0);
        await expect(page.locator('.preview-panel-column')).toBeHidden();
    });

    test('Shows the product form below the description when the product has no description or photo', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Modern stacked inline ${WorkerData.id}`,
            productCount: 1,
            cartEnabled: false,
            paymentMethods: [PaymentMethod.PointOfSale],
        });
        webshop.meta.description = RichText.create({ text: 'Alle info over deze actie', html: '<p>Alle info over deze actie</p>' });
        await webshop.save();

        await page.goto(WorkerData.urls.webshopUri(webshop.uri));
        const view = page.locator('.modern-webshop-view');
        await expect(view.getByTestId('cart-item-view')).toBeVisible({ timeout: 15000 });
        await expect(view.getByText('Alle info over deze actie')).toBeVisible();
        await expect(page.getByTestId('single-order-button')).toHaveCount(0);

        // Below the content, the form has no title of its own
        await expect(view.getByTestId('cart-item-view').getByRole('heading', { level: 2, name: 'Product 1' })).toHaveCount(0);
    });

    test('Shows an order button when the single product has a photo', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Modern photo ${WorkerData.id}`,
            productCount: 1,
            cartEnabled: false,
            paymentMethods: [PaymentMethod.PointOfSale],
        });
        // Without a webshop description: the photo of the product alone is enough for a separate step
        webshop.products[0].images = [Image.create({
            source: new File({ id: 'product-photo', server: 'https://files.example.com', path: 'product-photo.jpg', size: 1000 }),
        })];
        await webshop.save();

        await page.goto(WorkerData.urls.webshopUri(webshop.uri));
        await expect(page.locator('.modern-webshop-view').getByTestId('single-order-button')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('cart-item-view')).toHaveCount(0);
    });
});
