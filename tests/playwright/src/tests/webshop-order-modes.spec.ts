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
import { PaymentMethod, Permissions, Product, ProductDateRange, ProductPrice, ProductType, STPackageBundle, Token as TokenStruct, Version, WebshopOrderMode, WebshopTicketType, WebshopType } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { WebshopOrderFlow } from '../flows/WebshopOrderFlow.js';
import { DashboardPage, DashboardTab, WorkerData } from '../helpers/index.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

let organizationCounter = 0;

async function createOrganization({ modernWebshop = true }: { modernWebshop?: boolean } = {}) {
    organizationCounter += 1;
    const organization = await new OrganizationFactory({
        name: `OrderModes${WorkerData.id}-${Date.now()}-${organizationCounter}`,
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
        window.localStorage.setItem('token-' + organizationId, tokenString);
    }, { organizationId, tokenString });
}

async function openWebshopsAsAdmin(page: Page, organization: Organization) {
    const admin = await new UserFactory({
        email: `admin-${WorkerData.id}-${Date.now()}@test.be`,
        organization,
        permissions: Permissions.create({ level: PermissionLevel.Full }),
    }).create();
    await loginAs({ page, user: admin });

    const dashboard = new DashboardPage(page);
    await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
    await dashboard.openTab(DashboardTab.Webshops);
}

async function openRecordSettings(page: Page, organization: Organization, webshop: Webshop) {
    await openWebshopsAsAdmin(page, organization);
    await page.getByTestId('webshop-menu-item').filter({ hasText: webshop.meta.name }).click();
    await page.getByRole('heading', { name: 'Contactgegevens' }).click();
}

async function openProductOffer(page: Page, organization: Organization, webshop: Webshop) {
    await openWebshopsAsAdmin(page, organization);
    await page.getByTestId('webshop-menu-item').filter({ hasText: webshop.meta.name }).click();
    // Named differently for a webshop with only tickets
    await page.getByRole('heading', { name: /^(Productaanbod|Aanbod tickets en vouchers)$/ }).click();
}

test.describe('Webshop order modes @webshop-order-modes', () => {
    test('A new event webshop starts with choosing amounts', async ({ page }) => {
        const organization = await createOrganization();
        await openWebshopsAsAdmin(page, organization);

        await page.locator('button.menu-button:has(.icon.add)').click();
        const popup = page.locator('.popup');
        await popup.locator('input.input').first().fill('Fuif');
        await popup.locator('.illustration-radio-box').filter({ hasText: 'Evenement met tickets' }).click();
        await popup.getByTestId('save-button').click();

        await expect.poll(async () => (await Webshop.select().where('organizationId', organization.id).fetch()).length).toBe(1);
        const [webshop] = await Webshop.select().where('organizationId', organization.id).fetch();
        expect(webshop.meta.type).toBe(WebshopType.Event);
        expect(webshop.meta.orderMode).toBe(WebshopOrderMode.Bulk);
    });

    test('One at a time without products starts with a single form', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Kamp ${WorkerData.id}`,
            buildProducts: () => [],
        });

        await openProductOffer(page, organization, webshop);
        await page.getByTestId('order-mode-single').click();

        // The settings of the form are on the page itself, instead of a list of products. Settings that belong to the
        // webshop itself are hidden.
        await expect(page.getByTestId('add-product-button')).toBeVisible();
        await expect(page.getByText('Keuze voor aantal stuks verbergen')).toHaveCount(0);
        await expect(page.locator('textarea')).toHaveCount(0);
        await page.locator('.st-view').last().getByTestId('save-button').click();

        await expect.poll(async () => (await Webshop.getByID(webshop.id))!.products.length).toBe(1);
        const saved = (await Webshop.getByID(webshop.id))!;
        expect(saved.meta.orderMode).toBe(WebshopOrderMode.Single);
        // Named after the webshop, and one piece per order because of the order mode
        expect(saved.products[0].name).toBe(webshop.meta.name);
        expect(saved.products[0].allowMultiple).toBeNull();
    });

    test('A ticket form has a date and an optional location', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Fuif ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            buildProducts: () => [],
        });

        await openProductOffer(page, organization, webshop);
        await page.getByTestId('order-mode-single').click();

        await expect(page.getByTestId('add-product-button')).toHaveText(/Ticket toevoegen/);
        await expect(page.getByTestId('add-location-button')).toBeVisible();
        await page.locator('.st-view').last().getByTestId('save-button').click();

        await expect.poll(async () => (await Webshop.getByID(webshop.id))!.products.length).toBe(1);
        const [product] = (await Webshop.getByID(webshop.id))!.products;
        expect(product.dateRange).not.toBeNull();
        expect(product.location).toBeNull();
    });

    test('A new ticket keeps the date over several days that it copies from another ticket', async ({ page }) => {
        const organization = await createOrganization();
        // Friday 20:00 until Sunday 18:00 in Brussels
        const startDate = new Date('2030-05-03T18:00:00Z');
        const endDate = new Date('2030-05-05T16:00:00Z');
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Festival ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            orderMode: WebshopOrderMode.Cart,
            buildProducts: () => [
                Product.create({ name: 'Weekendticket', type: ProductType.Ticket, dateRange: ProductDateRange.create({ startDate, endDate }) }),
            ],
        });

        await openProductOffer(page, organization, webshop);
        await page.getByTestId('add-product-button').click();

        const view = page.locator('.st-view').last();
        await expect(view.getByRole('checkbox', { name: 'Meerdere dagen' })).toBeChecked();
        await view.locator('.st-input-box').filter({ hasText: 'Naam' }).locator('input').first().fill('Late ingang');
        await view.locator('.st-input-box').filter({ hasText: 'Vanaf welk tijdstip' }).locator('input').fill('21:00');
        await view.getByTestId('save-button').click();
        await page.locator('.st-view').last().getByTestId('save-button').click();

        await expect.poll(async () => (await Webshop.getByID(webshop.id))!.products.length).toBe(2);
        const added = (await Webshop.getByID(webshop.id))!.products.find(p => p.name === 'Late ingang')!;
        expect(added.dateRange?.startDate.getTime()).toBe(new Date('2030-05-03T19:00:00Z').getTime());
        expect(added.dateRange?.endDate.getTime()).toBe(endDate.getTime());
    });

    test('Participant details per ticket are only offered with several tickets', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop: one } = await TestWebshops.create({ organization, name: `Een ticket ${WorkerData.id}`, ticketType: WebshopTicketType.Tickets, productCount: 1 });
        const { webshop: several } = await TestWebshops.create({ organization, name: `Twee tickets ${WorkerData.id}`, ticketType: WebshopTicketType.Tickets, productCount: 2 });

        await openRecordSettings(page, organization, one);
        await expect(page.getByRole('heading', { name: 'Extra stappen' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Gegevens van de besteller' })).toHaveCount(0);
        await expect(page.getByTestId('participant-mode-item')).toHaveCount(0);

        // Opens the dashboard again, which closes the popup of the first webshop
        await openRecordSettings(page, organization, several);
        await expect(page.getByTestId('participant-mode-item')).toBeVisible();
    });

    test('Participant details per ticket do not depend on which ticket is listed first', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Volgorde ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            orderMode: WebshopOrderMode.Cart,
            buildProducts: () => [
                // An older ticket that only allows one piece
                Product.create({ name: 'Uniek', type: ProductType.Ticket, allowMultiple: false }),
                Product.create({ name: 'Standaard', type: ProductType.Ticket }),
            ],
        });

        await openRecordSettings(page, organization, webshop);
        await expect(page.getByTestId('participant-mode-item')).toBeVisible();
    });

    test('Without the modern webshop, the cart can be turned off for a single product', async ({ page }) => {
        const organization = await createOrganization({ modernWebshop: false });
        const { webshop } = await TestWebshops.create({ organization, name: `Klassiek ${WorkerData.id}`, productCount: 1 });

        await openProductOffer(page, organization, webshop);
        await page.getByText('Winkelmandje gebruiken').click();
        await page.locator('.st-view').last().getByTestId('save-button').click();

        await expect.poll(async () => (await Webshop.getByID(webshop.id))!.meta.orderMode).toBe(WebshopOrderMode.Single);
    });

    test('The preview shows changes before saving, without ordering', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Preview ${WorkerData.id}`,
            productCount: 2,
            cartEnabled: true,
        });

        await openProductOffer(page, organization, webshop);

        const preview = page.frameLocator('.webshop-preview-card iframe');
        await expect(preview.getByTestId('product-box')).toHaveCount(2, { timeout: 20000 });

        // Not saved yet: the preview follows the settings
        await page.getByTestId('order-mode-bulk').click();
        await expect(preview.getByTestId('bulk-product-row')).toHaveCount(2);

        // All steps can be followed, but the order is never placed
        await preview.getByTestId('bulk-stepper').first().locator('button.plus').click();
        await preview.getByTestId('bulk-order-button').click();
        // The administrator is logged in on the webshop too: only the name is missing from the account
        const customerStep = preview.getByTestId('customer-step');
        await customerStep.locator('input[name="fname"]').fill('John');
        await customerStep.locator('input[name="lname"]').fill('Doe');
        await customerStep.getByTestId('save-button').click();
        await preview.getByTestId('payment-step').getByTestId('save-button').click();
        await expect(preview.getByTestId('toast-box')).toContainText('In een voorbeeld kan je niet bestellen');

        // The large preview shows the same webshop
        await page.getByTestId('webshop-full-preview-button').click();
        await expect(page.frameLocator('.webshop-full-preview-view iframe').getByTestId('bulk-product-row')).toHaveCount(2, { timeout: 20000 });

        expect((await Webshop.getByID(webshop.id))!.meta.orderMode).toBe(WebshopOrderMode.Cart);
        expect(await Order.select().where('webshopId', webshop.id).fetch()).toHaveLength(0);
    });

    test('Without room next to the settings, the preview opens from the navigation bar', async ({ page }) => {
        // The width of a phone: the view moves its other buttons to the toolbar at the bottom
        await page.setViewportSize({ width: 390, height: 844 });
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Preview smal ${WorkerData.id}`,
            productCount: 2,
            cartEnabled: true,
        });

        await openProductOffer(page, organization, webshop);
        await page.getByTestId('order-mode-bulk').click();
        await expect(page.locator('.webshop-preview-card')).toBeHidden();

        // Not saved yet: the popup shows the changed settings
        const previewButton = page.locator('.st-navigation-bar-container').getByTestId('webshop-preview-button');
        await previewButton.click();
        await expect(page.frameLocator('.webshop-full-preview-view iframe').getByTestId('bulk-product-row')).toHaveCount(2, { timeout: 20000 });
    });

    test('A form keeps showing the settings it already used', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Formulier ${WorkerData.id}`,
            orderMode: WebshopOrderMode.Single,
            buildProducts: () => [
                Product.create({ name: 'Eigen naam', description: 'Oude beschrijving', allowMultiple: true, prices: [ProductPrice.create({ price: 10_0000 })] }),
            ],
        });

        await openProductOffer(page, organization, webshop);

        await expect(page.getByTestId('add-product-button')).toBeVisible();
        await expect(page.locator('textarea')).toHaveValue('Oude beschrijving');
        await expect(page.locator('.st-input-box').filter({ hasText: 'Naam' }).locator('input')).toHaveValue('Eigen naam');
        await expect(page.getByText('Keuze voor aantal stuks verbergen')).toBeVisible();
    });

    test('Renaming the webshop renames its form', async ({ page }) => {
        const organization = await createOrganization();
        const name = `Kamp ${WorkerData.id}`;
        const { webshop } = await TestWebshops.create({
            organization,
            name,
            orderMode: WebshopOrderMode.Single,
            buildProducts: () => [
                Product.create({ name, prices: [ProductPrice.create({ price: 10_0000 })] }),
            ],
        });

        await openWebshopsAsAdmin(page, organization);
        await page.getByTestId('webshop-menu-item').filter({ hasText: name }).click();
        await page.getByRole('heading', { name: 'Algemeen' }).click();
        await page.locator('.popup input.input').first().fill('Zomerkamp');
        await page.locator('.popup').getByTestId('save-button').click();

        await expect.poll(async () => (await Webshop.getByID(webshop.id))!.meta.name).toBe('Zomerkamp');
        expect((await Webshop.getByID(webshop.id))!.products[0].name).toBe('Zomerkamp');
    });

    test('One ticket per order is not offered with a seating plan', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Voorstelling ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            withSeatingPlan: true,
        });

        await openProductOffer(page, organization, webshop);

        await expect(page.getByTestId('order-mode-bulk')).toBeVisible();
        await expect(page.getByTestId('order-mode-single')).toHaveCount(0);
    });

    test('The preview keeps the changes after opening the cart', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Preview cart ${WorkerData.id}`,
            productCount: 2,
            orderMode: WebshopOrderMode.Bulk,
        });

        await openProductOffer(page, organization, webshop);
        const preview = page.frameLocator('.webshop-preview-card iframe');
        await expect(preview.getByTestId('bulk-product-row')).toHaveCount(2, { timeout: 20000 });

        // Not saved: a cart
        await page.getByTestId('order-mode-cart').click();
        await expect(preview.getByTestId('product-box')).toHaveCount(2);

        await preview.getByTestId('product-box').first().click();
        await preview.getByTestId('cart-item-view').getByTestId('save-button').click();
        await preview.getByTestId('open-cart-button').click();
        await expect(preview.getByTestId('cart-checkout-button')).toBeVisible();

        // Opening the cart reloads the webshop, which must not bring back the saved order mode
        await preview.getByRole('button', { name: 'Terug' }).click();
        await expect(preview.getByTestId('product-box')).toHaveCount(2);
        await expect(preview.getByTestId('bulk-product-row')).toHaveCount(0);
    });

    test('The preview drops the extra pieces when switching to one at a time', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Preview single ${WorkerData.id}`,
            orderMode: WebshopOrderMode.Bulk,
        });

        await openProductOffer(page, organization, webshop);
        const preview = page.frameLocator('.webshop-preview-card iframe');
        await expect(preview.getByTestId('bulk-product-row')).toHaveCount(1, { timeout: 20000 });

        await preview.getByTestId('bulk-amount').fill('5');
        await preview.getByTestId('bulk-amount').blur();
        await expect(preview.getByTestId('bulk-amount')).toHaveValue('5');

        await page.getByTestId('order-mode-single').click();
        const form = preview.getByTestId('cart-item-view');
        await expect(form).toBeVisible();
        await expect(form).not.toContainText('Je hebt het maximaal aantal stuks bereikt');
        await expect(form.getByTestId('save-button')).toBeVisible();
    });

    test('A saved cart with several pieces becomes one piece when the webshop orders one at a time', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Wissel ${WorkerData.id}`,
            orderMode: WebshopOrderMode.Bulk,
        });

        await page.goto(WorkerData.urls.webshopUri(webshop.uri));
        await page.getByTestId('bulk-amount').fill('5');
        await page.getByTestId('bulk-amount').blur();
        await expect(page.getByTestId('bulk-amount')).toHaveValue('5');

        webshop.meta.orderMode = WebshopOrderMode.Single;
        await webshop.save();

        await page.reload();
        const form = page.getByTestId('cart-item-view');
        await expect(form).toBeVisible({ timeout: 15000 });
        await expect(form).not.toContainText('Je hebt het maximaal aantal stuks bereikt');
        await expect(form.getByTestId('save-button')).toBeVisible();
    });

    test('A saved cart with units of the bulk mode is combined again when the webshop switches to a cart', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Wissel cart ${WorkerData.id}`,
            orderMode: WebshopOrderMode.Bulk,
        });

        await page.goto(WorkerData.urls.webshopUri(webshop.uri));
        await page.getByTestId('bulk-amount').fill('3');
        await page.getByTestId('bulk-amount').blur();
        await expect(page.getByTestId('bulk-amount')).toHaveValue('3');

        webshop.meta.orderMode = WebshopOrderMode.Cart;
        await webshop.save();

        await page.reload();
        const flow = new WebshopOrderFlow(page, { orderMode: WebshopOrderMode.Cart });
        await flow.openCart();
        await expect(page.locator('.cart-item-row')).toHaveCount(1);
        await expect(page.locator('.cart-item-row .amount')).toHaveText('3');
    });

    test('One at a time with several products: the visitor picks one, which opens as a step when it has choices', async ({ page }) => {
        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Kampen ${WorkerData.id}`,
            orderMode: WebshopOrderMode.Single,
            paymentMethods: [PaymentMethod.PointOfSale],
            buildProducts: () => [
                Product.create({ name: 'Kamp kapoenen', prices: [ProductPrice.create({ price: 120_0000 })] }),
                Product.create({ name: 'Kamp welpen', prices: [ProductPrice.create({ name: 'Lid', price: 140_0000 }), ProductPrice.create({ name: 'Niet-lid', price: 160_0000 })] }),
            ],
        });

        const flow = new WebshopOrderFlow(page, { orderMode: WebshopOrderMode.Single });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));

        await expect(page.getByTestId('single-product-row')).toHaveCount(2);
        await page.getByTestId('single-order-button').click();
        await expect(page.getByTestId('toast-box')).toContainText('Maak eerst een keuze');

        await page.getByTestId('single-product-row').filter({ hasText: 'Kamp welpen' }).click();
        await page.getByTestId('single-order-button').click();
        await expect(page.getByTestId('cart-item-view')).toContainText('Kamp welpen');

        // The chosen product stays the step after a reload
        await expect(page).toHaveURL(/\/product$/);
        await page.reload();
        await expect(page.getByTestId('cart-item-view')).toContainText('Kamp welpen');

        // Back to the list keeps the choice
        await page.getByTestId('checkout-progress').getByRole('button', { name: 'Keuze' }).click();
        await expect(page.getByTestId('single-product-row').filter({ hasText: 'Kamp welpen' }).locator('input')).toBeChecked();

        // Nothing to choose: the checkout starts right away, after the list in the progress
        await page.getByTestId('single-product-row').filter({ hasText: 'Kamp kapoenen' }).click();
        await page.getByTestId('single-order-button').click();
        await expect(page.getByTestId('customer-step')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('cart-item-view')).toHaveCount(0);
        await expect(page.getByTestId('checkout-progress').getByRole('button', { name: 'Keuze' })).toBeVisible();

        await page.reload();
        await expect(page.getByTestId('customer-step')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('cart-item-view')).toHaveCount(0);

        await flow.fillCustomer();
        await flow.confirmPayment();
        await flow.expectOrderConfirmed();

        const orders = await Order.select().where('webshopId', webshop.id).fetch();
        expect(orders).toHaveLength(1);
        expect(orders[0].data.cart.items.map(i => i.product.name)).toEqual(['Kamp kapoenen']);
        expect(orders[0].data.cart.items[0].amount).toBe(1);
    });
});
