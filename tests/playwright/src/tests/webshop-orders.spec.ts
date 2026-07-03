// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Browser, Page } from '@playwright/test';
import { devices, expect } from '@playwright/test';
import { MollieMocker, PayconiqMocker, STPackageService, StripeMocker } from '@stamhoofd/backend/tests/helpers';
import type { User } from '@stamhoofd/models';
import { Organization, OrganizationFactory, Payment, Token, UserFactory } from '@stamhoofd/models';
import {
    MollieOnboarding,
    MollieStatus,
    PaymentMethod,
    PaymentProvider,
    PaymentStatus,
    PaymentType,
    PermissionLevel,
    Permissions,
    STPackageBundle,
    Token as TokenStruct,
    Version,
    WebshopTicketType,
} from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WebshopOrderFlow } from '../flows/WebshopOrderFlow.js';
import { DashboardPage, DashboardTab, TableHelper, WorkerData } from '../helpers/index.js';
import { WebshopOrdersView } from '../helpers/page/webshop/WebshopOrdersView.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

// Payment-method labels as shown in the PaymentSelectionList (partial, case-insensitive-safe text)
const PaymentLabel = {
    PointOfSale: 'plaatse',
    Transfer: 'verschrijving',
    Bancontact: 'Bancontact',
    Payconiq: 'Bancontact Pay | Wero',
};

const STRIPE_REDIRECT_URL = 'https://paymenturl/';
const MOLLIE_CHECKOUT_URL = 'https://molliecheckout/';

/**
 * Write the correct auth token into localStorage for the current userMode (mirrors routing.spec).
 * Only used for the admin "mark paid" step; the customer order flow itself is unauthenticated.
 */
async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await Token.createToken(user);
    const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));

    if (STAMHOOFD.userMode === 'platform') {
        await page.addInitScript(({ tokenString }) => {
            window.localStorage.setItem('token-platform', tokenString);
        }, { tokenString });
    } else {
        const organizationId = user.organizationId;
        await page.addInitScript(({ organizationId, tokenString }) => {
            if (organizationId) {
                window.localStorage.setItem('token-' + organizationId, tokenString);
            } else {
                window.localStorage.setItem('token-platform', tokenString);
            }
        }, { organizationId, tokenString });
    }
}

async function createWebshopOrganization(prefix: string): Promise<Organization> {
    const organization = await new OrganizationFactory({
        name: `${prefix}${WorkerData.id}`,
        packages: [STPackageBundle.Webshops],
    }).create();

    // Recalculate meta.packages so the public webshop is not rendered as "closed"
    await STPackageService.updateOrganizationPackages(organization.id);

    const refreshed = await Organization.getByID(organization.id);
    if (!refreshed) {
        throw new Error('Organization not found after creation');
    }
    return refreshed;
}

/**
 * Create an admin able to manage the given organization's webshop in the current userMode.
 */
async function createAdmin(organization: Organization): Promise<User> {
    const email = `admin-${WorkerData.id}-${Date.now()}@test.be`;
    const fullPermissions = Permissions.create({ level: PermissionLevel.Full });

    if (STAMHOOFD.userMode === 'platform') {
        return await new UserFactory({ email, globalPermissions: fullPermissions }).create();
    }
    return await new UserFactory({ email, organization, permissions: fullPermissions }).create();
}

/**
 * Intercept a hosted payment page (Stripe/Mollie/Payconiq) so the redirect lands on a mock page.
 */
async function mockHostedPaymentPage(page: Page, url: string) {
    await page.route(url, route => route.fulfill({
        contentType: 'text/html',
        body: '<html><body data-testid="provider-mock-page">Mock payment page</body></html>',
    }));
}

/**
 * Navigate the admin dashboard to the orders table of a webshop and wait for the first row.
 * Reusable to (re)open the table, e.g. after a page reload where the deep order URL isn't restored.
 */
async function openWebshopOrders(adminPage: Page, organization: Organization, webshopName: string): Promise<TableHelper> {
    const dashboard = new DashboardPage(adminPage);
    await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
    await dashboard.openTab(DashboardTab.Webshops);
    await adminPage.getByTestId('webshop-menu-item').filter({ hasText: webshopName }).click();
    await adminPage.getByTestId('open-orders-button').click();

    const table = new TableHelper(adminPage);
    await table.waitForFirstRow();
    return table;
}

/**
 * All webshop order scenarios. Registered inside both an organization-mode and a platform-mode
 * describe block so the full purchase flow is covered in both user modes.
 */
function registerWebshopOrderTests() {
    let stripeMocker: StripeMocker | undefined;
    let mollieMocker: MollieMocker | undefined;

    test.afterEach(async () => {
        stripeMocker?.stop();
        stripeMocker = undefined;
        mollieMocker?.stop();
        mollieMocker = undefined;
        PayconiqMocker.reset();
    });

    test('PointOfSale ticket order stays pending but ticket is downloadable', async ({ page }) => {
        const organization = await createWebshopOrganization('PosShop');
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Pos shop ${WorkerData.id}`,
            ticketType: WebshopTicketType.SingleTicket,
            productCount: 1,
            cartEnabled: false,
            paymentMethods: [PaymentMethod.PointOfSale],
        });

        const flow = new WebshopOrderFlow(page, { cartEnabled: false });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.addProduct('Product 1');
        await flow.goToCheckout();
        await flow.fillCustomer();
        await flow.selectPaymentMethod(PaymentLabel.PointOfSale);
        await flow.confirmPayment();

        await flow.expectPaymentPending();
        await flow.expectTicketsDownloadable();
        await flow.openFirstTicketQR();
    });

    test('Transfer per-item tickets: instructions first, tickets after admin marks paid (custom domain)', async ({ page, browser }) => {
        const organization = await createWebshopOrganization('TransferShop');
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Transfer shop ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            productCount: 2,
            cartEnabled: false,
            paymentMethods: [PaymentMethod.Transfer],
            customDomainPrefix: 'transfertickets',
        });

        const flow = new WebshopOrderFlow(page, { cartEnabled: false });
        await flow.goto(WorkerData.urls.webshopCustomDomain('transfertickets'));
        await flow.addProduct('Product 1');
        await flow.goToCheckout();
        await flow.fillCustomer();
        await flow.selectPaymentMethod(PaymentLabel.Transfer);
        await flow.confirmPayment();

        await flow.expectTransferInstructions();
        await flow.continueFromTransfer();
        await flow.expectNoTicketsYet();

        const orderUrl = page.url();

        // Admin marks the order paid in the dashboard
        const admin = await createAdmin(organization);
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        await loginAs({ page: adminPage, user: admin });

        const dashboard = new DashboardPage(adminPage);
        await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
        await dashboard.openTab(DashboardTab.Webshops);
        await adminPage.getByTestId('webshop-menu-item').filter({ hasText: webshop.meta.name }).click();
        await adminPage.getByTestId('open-orders-button').click();
        await new WebshopOrdersView(adminPage).markAllOrdersPaid();
        await adminContext.close();

        // After a reload, the customer can now download the tickets
        await page.goto(orderUrl);
        await flow.expectTicketsDownloadable({ immediate: false });
    });

    test('Bancontact via Stripe: multiple tickets downloadable immediately (custom domain + suffix)', async ({ page }) => {
        const organization = await createWebshopOrganization('StripeShop');
        stripeMocker = new StripeMocker();
        stripeMocker.start();
        const stripeAccount = await stripeMocker.createStripeAccount(organization.id, 'standard');

        await TestWebshops.create({
            organization,
            name: `Stripe shop ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            productCount: 2,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.Bancontact],
            stripeAccountId: stripeAccount.id,
            customDomainPrefix: 'stripetickets',
            domainUri: 'event-x',
        });

        await mockHostedPaymentPage(page, STRIPE_REDIRECT_URL);

        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopCustomDomain('stripetickets', 'event-x'));
        await flow.addProduct('Product 1');
        await flow.addProduct('Product 2');
        await flow.goToCheckout();
        await flow.fillCustomer();
        await flow.selectPaymentMethod(PaymentLabel.Bancontact);
        await flow.confirmPayment();

        await page.waitForURL(STRIPE_REDIRECT_URL);
        const intent = stripeMocker.getLastIntent();
        await stripeMocker.succeedPayment(intent);

        await page.goto(intent.return_url!);
        await flow.expectTicketsDownloadable();
        await flow.expectTicketCount(2);
    });

    test('Bancontact via Mollie: seated per-item tickets downloadable after success', async ({ page }) => {
        const organization = await createWebshopOrganization('MollieShop');
        organization.privateMeta.mollieOnboarding = MollieOnboarding.create({
            canReceivePayments: true,
            canReceiveSettlements: true,
            status: MollieStatus.Completed,
        });
        await organization.save();

        mollieMocker = new MollieMocker();
        mollieMocker.start();
        await mollieMocker.setupToken(organization);

        const { webshop } = await TestWebshops.create({
            organization,
            name: `Mollie shop ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            productCount: 2,
            cartEnabled: true,
            withSeatingPlan: true,
            paymentMethods: [PaymentMethod.Bancontact],
        });

        await mockHostedPaymentPage(page, MOLLIE_CHECKOUT_URL);

        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.addProduct('Product 1', { seats: 1 });
        await flow.addProduct('Product 2', { seats: 2 });
        await flow.goToCheckout();
        await flow.fillCustomer();
        await flow.selectPaymentMethod(PaymentLabel.Bancontact);
        await flow.confirmPayment();

        await page.waitForURL(MOLLIE_CHECKOUT_URL);
        await mollieMocker.succeedPayment();

        await page.goto(mollieMocker.getLastPayment().redirectUrl!);
        await flow.expectTicketsDownloadable();
        await flow.expectTicketCount(3);
    });

    /**
     * Create a Mollie-paid order of 2 x Product 1, then (as admin) lower the cart to 1 product
     * and create an online refund for the difference via the order view. Returns the admin page
     * with the order view still open.
     */
    async function createOrderAndRefundDifference(page: Page, browser: Browser, prefix: string) {
        const organization = await createWebshopOrganization(prefix);
        organization.privateMeta.mollieOnboarding = MollieOnboarding.create({
            canReceivePayments: true,
            canReceiveSettlements: true,
            status: MollieStatus.Completed,
        });
        await organization.save();

        mollieMocker = new MollieMocker();
        mollieMocker.start();
        await mollieMocker.setupToken(organization);

        const { webshop } = await TestWebshops.create({
            organization,
            name: `${prefix} shop ${WorkerData.id}`,
            ticketType: WebshopTicketType.None,
            productCount: 1,
            cartEnabled: false,
            paymentMethods: [PaymentMethod.Bancontact],
        });

        await mockHostedPaymentPage(page, MOLLIE_CHECKOUT_URL);

        const flow = new WebshopOrderFlow(page, { cartEnabled: false });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.addProduct('Product 1', { count: 2 });
        await flow.goToCheckout();
        await flow.fillCustomer();
        await flow.selectPaymentMethod(PaymentLabel.Bancontact);
        await flow.confirmPayment();

        await page.waitForURL(MOLLIE_CHECKOUT_URL);
        await mollieMocker.succeedPayment();
        await page.goto(mollieMocker.getLastPayment().redirectUrl!);
        await flow.expectOrderConfirmed();

        // The admin lowers the order to 1 product
        const admin = await createAdmin(organization);
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        await loginAs({ page: adminPage, user: admin });

        const table = await openWebshopOrders(adminPage, organization, webshop.meta.name);
        await table.getRow('John').click();

        const orderView = adminPage.getByTestId('order-view');
        await orderView.locator('button.icon.more').first().click();
        await adminPage.getByRole('button', { name: 'Wijzig...' }).click();

        const editOrderView = adminPage.getByTestId('edit-order-view');
        await editOrderView.locator('.cart-item-row button.icon.min').click();
        await editOrderView.getByTestId('save-button').click();
        await editOrderView.waitFor({ state: 'detached' });

        // The order is now paid too much: register the refund via the order
        await adminPage.getByRole('button', { name: 'Betaling / terugbetaling registreren' }).click();

        const refundView = adminPage.getByTestId('edit-payment-view');

        // The view preselects the open (negative) balance, switches the type to a refund
        // and selects the online refund via the Mollie payment of the order
        await expect(refundView.getByText('Online terugbetaling (automatisch)').first()).toBeVisible();

        await refundView.getByTestId('save-button').click();
        await adminPage.getByRole('button', { name: 'Ja, terugbetalen' }).click();
        await refundView.waitFor({ state: 'detached' });

        return { organization, webshop, adminContext, adminPage, table };
    }

    test('Bancontact via Mollie: a refund for an edited order shows up in the order immediately', async ({ page, browser }) => {
        const { adminContext, adminPage } = await createOrderAndRefundDifference(page, browser, 'MolliePendRef');

        // Without reloading, the order lists the pending refund: the backend bumped the
        // updatedAt of the order, so the local order database of the client refetched it
        const refundRow = adminPage.getByTestId('order-payment-row').filter({ hasText: 'Terugbetaling' });
        await expect(refundRow).toBeVisible();
        await expect(refundRow.locator('.icon.clock')).toBeVisible();

        // The open balance is settled by the pending refund
        await expect(adminPage.getByRole('button', { name: 'Betaling / terugbetaling registreren' })).toHaveCount(0);

        // The refund payment is registered in the backend, pending until Mollie executes it
        const sourcePaymentId = mollieMocker!.getLastPayment().internalPaymentId!;
        const sourcePayment = (await Payment.getByID(sourcePaymentId))!;
        const refunds = await Payment.select().where('reversingPaymentId', sourcePaymentId).fetch();
        expect(refunds).toHaveLength(1);
        expect(refunds[0]).toMatchObject({
            type: PaymentType.Refund,
            status: PaymentStatus.Pending,
            method: PaymentMethod.Bancontact,
            provider: PaymentProvider.Mollie,
            price: -(sourcePayment.price / 2),
        });

        await adminContext.close();
    });

    test('Bancontact via Mollie: a refund executed by Mollie is visible after reloading the orders', async ({ page, browser }) => {
        const { organization, webshop, adminContext, adminPage } = await createOrderAndRefundDifference(page, browser, 'MollieSetRef');

        const sourcePaymentId = mollieMocker!.getLastPayment().internalPaymentId!;
        const refunds = await Payment.select().where('reversingPaymentId', sourcePaymentId).fetch();
        expect(refunds).toHaveLength(1);
        expect(refunds[0].status).toBe(PaymentStatus.Pending);

        // Mollie executes the refund and calls the webhook
        await mollieMocker!.settleRefund();

        const settledRefund = await Payment.getByID(refunds[0].id);
        expect(settledRefund!.status).toBe(PaymentStatus.Succeeded);

        // Reopen the orders table: the client refetches the (updatedAt-bumped) order from its local
        // database, so the refund is now shown as succeeded in the order
        const table = await openWebshopOrders(adminPage, organization, webshop.meta.name);
        await table.getRow('John').click();

        const refundRow = adminPage.getByTestId('order-payment-row').filter({ hasText: 'Terugbetaling' });
        await expect(refundRow).toBeVisible();
        await expect(refundRow.locator('.icon.success')).toBeVisible();
        await expect(refundRow.locator('.icon.clock')).toHaveCount(0);

        await adminContext.close();
    });

    test('Bancontact via Mollie: admin can refund the payment online', async ({ page, browser }) => {
        const organization = await createWebshopOrganization('MollieRefund');
        organization.privateMeta.mollieOnboarding = MollieOnboarding.create({
            canReceivePayments: true,
            canReceiveSettlements: true,
            status: MollieStatus.Completed,
        });
        await organization.save();

        mollieMocker = new MollieMocker();
        mollieMocker.start();
        await mollieMocker.setupToken(organization);

        const { webshop } = await TestWebshops.create({
            organization,
            name: `Mollie refund ${WorkerData.id}`,
            ticketType: WebshopTicketType.None,
            productCount: 1,
            cartEnabled: false,
            paymentMethods: [PaymentMethod.Bancontact],
        });

        await mockHostedPaymentPage(page, MOLLIE_CHECKOUT_URL);

        const flow = new WebshopOrderFlow(page, { cartEnabled: false });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.addProduct('Product 1');
        await flow.goToCheckout();
        await flow.fillCustomer();
        await flow.selectPaymentMethod(PaymentLabel.Bancontact);
        await flow.confirmPayment();

        await page.waitForURL(MOLLIE_CHECKOUT_URL);
        await mollieMocker.succeedPayment();

        await page.goto(mollieMocker.getLastPayment().redirectUrl!);
        await flow.expectOrderConfirmed();

        // The admin refunds the payment online from the order in the dashboard
        const admin = await createAdmin(organization);
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        await loginAs({ page: adminPage, user: admin });

        const table = await openWebshopOrders(adminPage, organization, webshop.meta.name);
        await table.getRow('John').click();

        // Open the payment of the order and start a refund
        await adminPage.getByTestId('order-payment-row').click();
        await adminPage.getByTestId('refund-online-button').click();

        // The edit payment view preselects all items of the payment for a full
        // refund and defaults to an online refund via the payment provider
        const refundView = adminPage.getByTestId('edit-payment-view');
        await refundView.getByTestId('save-button').click();
        await adminPage.getByRole('button', { name: 'Ja, terugbetalen' }).click();
        await refundView.waitFor({ state: 'detached' });

        // The refund was created at Mollie for the full payment amount
        await expect.poll(() => mollieMocker?.refunds.length).toBe(1);
        expect(mollieMocker!.refunds[0].amount.value).toBe(mollieMocker!.getLastPayment().amount.value);

        // The refund payment was created in the backend, pending until Mollie executes it
        const sourcePaymentId = mollieMocker.getLastPayment().internalPaymentId!;
        const sourcePayment = (await Payment.getByID(sourcePaymentId))!;
        const refunds = await Payment.select().where('reversingPaymentId', sourcePaymentId).fetch();
        expect(refunds).toHaveLength(1);
        expect(refunds[0]).toMatchObject({
            type: PaymentType.Refund,
            status: PaymentStatus.Pending,
            method: PaymentMethod.Bancontact,
            provider: PaymentProvider.Mollie,
            price: -sourcePayment.price,
        });

        // The payment view shows the pending refund
        await expect(adminPage.getByText(/Er is een terugbetaling van/)).toBeVisible();

        // Mollie executes the refund and calls the webhook
        await mollieMocker.settleRefund();

        const settledRefund = await Payment.getByID(refunds[0].id);
        expect(settledRefund!.status).toBe(PaymentStatus.Succeeded);

        const updatedSource = await Payment.getByID(sourcePaymentId);
        expect(updatedSource!.refundedAmount).toBe(-sourcePayment.price);
        expect(updatedSource!.pendingRefundAmount).toBe(0);

        // After reopening the orders table, the order lists the succeeded refund
        const reloadedTable = await openWebshopOrders(adminPage, organization, webshop.meta.name);
        await reloadedTable.getRow('John').click();

        const refundRow = adminPage.getByTestId('order-payment-row').filter({ hasText: 'Terugbetaling' });
        await expect(refundRow).toBeVisible();
        await expect(refundRow.locator('.icon.success')).toBeVisible();

        await adminContext.close();
    });

    test('Bancontact via Stripe on a normal shop: paid confirmation, no tickets', async ({ page }) => {
        const organization = await createWebshopOrganization('StripeNormal');
        stripeMocker = new StripeMocker();
        stripeMocker.start();
        const stripeAccount = await stripeMocker.createStripeAccount(organization.id, 'standard');

        const { webshop } = await TestWebshops.create({
            organization,
            name: `Stripe normal ${WorkerData.id}`,
            ticketType: WebshopTicketType.None,
            productCount: 1,
            cartEnabled: false,
            paymentMethods: [PaymentMethod.Bancontact],
            stripeAccountId: stripeAccount.id,
        });

        await mockHostedPaymentPage(page, STRIPE_REDIRECT_URL);

        const flow = new WebshopOrderFlow(page, { cartEnabled: false });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.addProduct('Product 1');
        await flow.goToCheckout();
        await flow.fillCustomer();
        await flow.selectPaymentMethod(PaymentLabel.Bancontact);
        await flow.confirmPayment();

        await page.waitForURL(STRIPE_REDIRECT_URL);
        const intent = stripeMocker.getLastIntent();
        await stripeMocker.succeedPayment(intent);

        await page.goto(intent.return_url!);
        await flow.expectOrderConfirmed();
        await expect(page.getByTestId('tickets-section')).toHaveCount(0);
    });

    test('Transfer on a normal shop shows transfer instructions (custom domain + suffix)', async ({ page }) => {
        const organization = await createWebshopOrganization('TransferNormal');
        await TestWebshops.create({
            organization,
            name: `Transfer normal ${WorkerData.id}`,
            ticketType: WebshopTicketType.None,
            productCount: 2,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.Transfer],
            customDomainPrefix: 'transfershop',
            domainUri: 'bestellen',
        });

        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopCustomDomain('transfershop', 'bestellen'));
        await flow.addProduct('Product 1');
        await flow.addProduct('Product 2');
        await flow.goToCheckout();
        await flow.fillCustomer();
        await flow.selectPaymentMethod(PaymentLabel.Transfer);
        await flow.confirmPayment();

        await flow.expectTransferInstructions();
    });

    test('Bancontact via Stripe returns correctly on a custom domain without suffix', async ({ page }) => {
        const organization = await createWebshopOrganization('StripeCustom');
        stripeMocker = new StripeMocker();
        stripeMocker.start();
        const stripeAccount = await stripeMocker.createStripeAccount(organization.id, 'standard');

        await TestWebshops.create({
            organization,
            name: `Stripe custom ${WorkerData.id}`,
            ticketType: WebshopTicketType.None,
            productCount: 2,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.Bancontact],
            stripeAccountId: stripeAccount.id,
            customDomainPrefix: 'stripeshop',
        });

        await mockHostedPaymentPage(page, STRIPE_REDIRECT_URL);

        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopCustomDomain('stripeshop'));
        await flow.addProduct('Product 1');
        await flow.addProduct('Product 2');
        await flow.goToCheckout();
        await flow.fillCustomer();
        await flow.selectPaymentMethod(PaymentLabel.Bancontact);
        await flow.confirmPayment();

        await page.waitForURL(STRIPE_REDIRECT_URL);
        const intent = stripeMocker.getLastIntent();
        // The Stripe return url must point at the custom webshop domain
        expect(intent.return_url).toContain(WorkerData.urls.webshopCustomDomain('stripeshop').replace('https://', ''));
        await stripeMocker.succeedPayment(intent);

        await page.goto(intent.return_url!);
        await flow.expectOrderConfirmed();
    });

    test('Payconiq desktop QR flow: tickets downloadable after payment succeeds', async ({ page }) => {
        const organization = await createWebshopOrganization('PayconiqDesktop');
        organization.privateMeta.payconiqAccounts = [PayconiqMocker.generateTestAccount()];
        await organization.save();

        PayconiqMocker.setup();

        const { webshop } = await TestWebshops.create({
            organization,
            name: `Payconiq desktop ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            productCount: 2,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.Payconiq],
        });

        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.addProduct('Product 1');
        await flow.addProduct('Product 2');
        await flow.goToCheckout();
        await flow.fillCustomer();
        await flow.selectPaymentMethod(PaymentLabel.Payconiq);
        await flow.confirmPayment();

        await expect(page.getByTestId('payconiq-qr')).toBeVisible({ timeout: 15000 });
        await PayconiqMocker.succeedPayment();

        // The banner polls the payment status and continues to the order once paid
        await flow.expectTicketsDownloadable();
        await flow.expectTicketCount(2);
    });

    test('Payconiq mobile app-to-app flow returns to the order via the return url', async ({ browser }) => {
        const organization = await createWebshopOrganization('PayconiqMobile');
        organization.privateMeta.payconiqAccounts = [PayconiqMocker.generateTestAccount()];
        await organization.save();

        PayconiqMocker.setup();

        const { webshop } = await TestWebshops.create({
            organization,
            name: `Payconiq mobile ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            productCount: 2,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.Payconiq],
        });

        // Keep the iPhone user agent so PaymentHandler.getOS() detects iOS and uses the app-to-app button
        const context = await browser.newContext({ ...devices['iPhone 13'] });
        const page = await context.newPage();
        await mockHostedPaymentPage(page, 'https://payconiq-checkout.test/**');

        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.addProduct('Product 1');
        await flow.addProduct('Product 2');
        await flow.goToCheckout();
        await flow.fillCustomer();
        await flow.selectPaymentMethod(PaymentLabel.Payconiq);
        await flow.confirmPayment();

        // App-to-app: open the (mocked) Payconiq checkout page
        await page.getByTestId('payconiq-app-button').click();
        await expect(page.getByTestId('provider-mock-page')).toBeVisible();

        await PayconiqMocker.succeedPayment();

        // Payconiq returns the customer to the return url it received
        await page.goto(PayconiqMocker.getLastPayment().returnUrl!);
        await flow.expectTicketsDownloadable();
        await flow.expectTicketCount(2);

        await context.close();
    });

    test('Failed Bancontact via Stripe returns to the payment selection step', async ({ page }) => {
        const organization = await createWebshopOrganization('StripeFail');
        stripeMocker = new StripeMocker();
        stripeMocker.start();
        const stripeAccount = await stripeMocker.createStripeAccount(organization.id, 'standard');

        const { webshop } = await TestWebshops.create({
            organization,
            name: `Stripe fail ${WorkerData.id}`,
            ticketType: WebshopTicketType.None,
            productCount: 2,
            cartEnabled: true,
            paymentMethods: [PaymentMethod.Bancontact],
            stripeAccountId: stripeAccount.id,
        });

        await mockHostedPaymentPage(page, STRIPE_REDIRECT_URL);

        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.addProduct('Product 1');
        await flow.addProduct('Product 2');
        await flow.goToCheckout();
        await flow.fillCustomer();
        await flow.selectPaymentMethod(PaymentLabel.Bancontact);
        await flow.confirmPayment();

        await page.waitForURL(STRIPE_REDIRECT_URL);
        const intent = stripeMocker.getLastIntent();
        await stripeMocker.failPayment(intent);

        await page.goto(intent.return_url!);

        // The failure message is shown; closing it returns to the payment selection step
        await page.getByTestId('centered-message-button').click();
        await flow.expectBackOnPaymentSelection();
    });

    test('Zero-price order skips payment and tickets are downloadable', async ({ page }) => {
        const organization = await createWebshopOrganization('FreeShop');
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Free shop ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            productCount: 2,
            cartEnabled: true,
            price: 0,
            paymentMethods: [PaymentMethod.PointOfSale],
        });

        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.addProduct('Product 1');
        await flow.addProduct('Product 2');
        await flow.goToCheckout();
        await flow.fillCustomer();
        // No payment method: the payment step is a zero-total confirmation
        await flow.confirmPayment();

        await flow.expectTicketsDownloadable();
        await flow.expectTicketCount(2);
    });
}

test.describe('Webshop orders (organization mode) @webshop-orders', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    registerWebshopOrderTests();
});

test.describe('Webshop orders (platform mode) @webshop-orders @extra', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');
    });

    registerWebshopOrderTests();
});
