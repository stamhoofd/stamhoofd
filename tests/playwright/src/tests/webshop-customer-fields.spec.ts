// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import type { User } from '@stamhoofd/models';
import { Order, Organization, OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import {
    Gender,
    PaymentMethod,
    PermissionLevel,
    Permissions,
    STPackageBundle,
    Token as TokenStruct,
    Version,
} from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { TestUtils } from '@stamhoofd/test-utils';
import type { TestAddress, TestBirthDay } from '../flows/WebshopOrderFlow.js';
import { WebshopOrderFlow } from '../flows/WebshopOrderFlow.js';
import { DashboardPage, DashboardTab, WorkerData } from '../helpers/index.js';
import { WebshopOrdersView } from '../helpers/page/webshop/WebshopOrdersView.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

const PointOfSaleLabel = 'plaatse';

// A French address avoids the Belgian/Dutch postal-code database lookup during validation.
const testAddress: TestAddress = { street: 'Rue de Test', number: '10', postalCode: '75001', city: 'Paris', country: Country.France };
const testBirthDay: TestBirthDay = { day: 15, month: 6, year: 1990 };

async function createWebshopOrganization(prefix: string): Promise<Organization> {
    const organization = await new OrganizationFactory({
        name: `${prefix}${WorkerData.id}`,
        packages: [STPackageBundle.Webshops],
    }).create();

    await STPackageService.updateOrganizationPackages(organization.id);

    const refreshed = await Organization.getByID(organization.id);
    if (!refreshed) {
        throw new Error('Organization not found after creation');
    }
    return refreshed;
}

async function createAdmin(organization: Organization): Promise<User> {
    const email = `admin-${WorkerData.id}-${Date.now()}@test.be`;
    const fullPermissions = Permissions.create({ level: PermissionLevel.Full });

    if (STAMHOOFD.userMode === 'platform') {
        return await new UserFactory({ email, globalPermissions: fullPermissions }).create();
    }
    return await new UserFactory({ email, organization, permissions: fullPermissions }).create();
}

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

/** Navigate the admin dashboard to a webshop's orders table (works even when there are no orders yet). */
async function openWebshopOrders(adminPage: Page, organization: Organization, webshopName: string) {
    const dashboard = new DashboardPage(adminPage);
    await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
    await dashboard.openTab(DashboardTab.Webshops);
    await adminPage.getByTestId('webshop-menu-item').filter({ hasText: webshopName }).click();
    await adminPage.getByTestId('open-orders-button').click();
    await adminPage.getByTestId('table').waitFor();
}

test.describe('Webshop customer fields (organization mode) @webshop-customer-fields', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test('only asks for birth day, gender and address when enabled', async ({ page }) => {
        const organization = await createWebshopOrganization('CustFields');

        // A shop with all fields disabled does not show them in the customer step
        const disabled = await TestWebshops.create({
            organization,
            name: `Fields off ${WorkerData.id}`,
            productCount: 1,
            cartEnabled: false,
            paymentMethods: [PaymentMethod.PointOfSale],
        });

        const offFlow = new WebshopOrderFlow(page, { cartEnabled: false });
        await offFlow.goto(WorkerData.urls.webshopUri(disabled.webshop.uri));
        await offFlow.addProduct('Product 1');
        await offFlow.goToCheckout();
        await offFlow.expectCustomerFields({ birthDay: false, gender: false, address: false });

        // A shop with all fields enabled shows them
        const enabled = await TestWebshops.create({
            organization,
            name: `Fields on ${WorkerData.id}`,
            productCount: 1,
            cartEnabled: false,
            paymentMethods: [PaymentMethod.PointOfSale],
            birthDayEnabled: true,
            addressEnabled: true,
            genderEnabled: true,
        });

        const onFlow = new WebshopOrderFlow(page, { cartEnabled: false });
        await onFlow.goto(WorkerData.urls.webshopUri(enabled.webshop.uri));
        await onFlow.addProduct('Product 1');
        await onFlow.goToCheckout();
        await onFlow.expectCustomerFields({ birthDay: true, gender: true, address: true });
    });

    test('stores birth day, gender and address for a webshop order', async ({ page }) => {
        const organization = await createWebshopOrganization('CustFieldsWebshop');
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Webshop fields ${WorkerData.id}`,
            productCount: 1,
            cartEnabled: false,
            paymentMethods: [PaymentMethod.PointOfSale],
            birthDayEnabled: true,
            addressEnabled: true,
            genderEnabled: true,
        });

        const flow = new WebshopOrderFlow(page, { cartEnabled: false });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.addProduct('Product 1');
        await flow.goToCheckout();
        await flow.fillCustomer({ birthDay: testBirthDay, gender: 'Female', address: testAddress });
        await flow.selectPaymentMethod(PointOfSaleLabel);
        await flow.confirmPayment();
        await flow.expectOrderConfirmed();

        // The confirmation page lists the filled-in information
        const orderView = page.getByTestId('order-view');
        await expect(orderView).toContainText('Paris');
        await expect(orderView).toContainText('1990');
        await expect(orderView).toContainText($t('%XM')); // "Vrouw"

        // The fields are stored on the order in the database
        const orders = await Order.select().where('webshopId', webshop.id).fetch();
        expect(orders).toHaveLength(1);
        const customer = orders[0].data.customer;
        expect(customer.gender).toBe(Gender.Female);
        expect(customer.address?.city).toBe('Paris');
        expect(customer.birthDay?.getFullYear()).toBe(1990);
    });

    test('stores birth day, gender and address for a dashboard order', async ({ browser }) => {
        const organization = await createWebshopOrganization('CustFieldsDash');
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Dashboard fields ${WorkerData.id}`,
            productCount: 1,
            cartEnabled: false,
            paymentMethods: [PaymentMethod.PointOfSale],
            birthDayEnabled: true,
            addressEnabled: true,
            genderEnabled: true,
        });

        const admin = await createAdmin(organization);
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        await loginAs({ page: adminPage, user: admin });

        await openWebshopOrders(adminPage, organization, webshop.meta.name);

        await new WebshopOrdersView(adminPage).addOrder({
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane.doe@test.be',
            product: webshop.products[0],
            paymentMethod: PaymentMethod.PointOfSale,
            birthDay: testBirthDay,
            gender: 'Male',
            address: testAddress,
        });

        const orders = await Order.select().where('webshopId', webshop.id).fetch();
        expect(orders).toHaveLength(1);
        const customer = orders[0].data.customer;
        expect(customer.firstName).toBe('Jane');
        expect(customer.gender).toBe(Gender.Male);
        expect(customer.address?.city).toBe('Paris');
        expect(customer.birthDay?.getFullYear()).toBe(1990);

        await adminContext.close();
    });

    test('syncs the delivery address to the customer address', async ({ page }) => {
        const organization = await createWebshopOrganization('CustFieldsDelivery');
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Delivery fields ${WorkerData.id}`,
            productCount: 1,
            cartEnabled: false,
            paymentMethods: [PaymentMethod.PointOfSale],
            addressEnabled: true,
            deliveryCountries: [Country.France],
        });

        const flow = new WebshopOrderFlow(page, { cartEnabled: false });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.addProduct('Product 1');

        // The delivery address is asked in its own step, before the customer step
        await flow.fillDeliveryAddressStep(testAddress);

        // The customer step does not ask for the address again (delivery already collected it)
        await flow.expectCustomerFields({ birthDay: false, gender: false, address: false });
        await flow.fillCustomer();
        // For a delivery order the "point of sale" method is labelled "bij levering"
        await flow.selectPaymentMethod('levering');
        await flow.confirmPayment();
        await flow.expectOrderConfirmed();

        // The delivery address is copied onto the customer
        const orders = await Order.select().where('webshopId', webshop.id).fetch();
        expect(orders).toHaveLength(1);
        const data = orders[0].data;
        expect(data.address).not.toBeNull();
        expect(data.customer.address).not.toBeNull();
        expect(data.customer.address?.city).toBe('Paris');
        expect(data.customer.address?.toString()).toBe(data.address?.toString());
    });
});
