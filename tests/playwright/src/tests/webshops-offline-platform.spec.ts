// test should always be imported first
import { test } from '../test-fixtures/platform.js';

// other imports
import { devices, expect } from '@playwright/test';
import type {
    Organization,
    RegistrationPeriod,
    User,
    Webshop
} from '@stamhoofd/models';
import {
    OrganizationFactory,
    RegistrationPeriodFactory
} from '@stamhoofd/models';
import { PaymentMethod, PermissionLevel, Permissions, PropertyFilter, UserPermissions } from '@stamhoofd/structures';
import {
    DashboardPage,
    DashboardTab,
    TableHelper,
    WorkerData
} from '../helpers/index.js';
import { WebshopOrdersView } from '../helpers/page/webshop/WebshopOrdersView.js';
import { simulateNetworkOffline } from '../helpers/simulateNetworkOffline.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

test.describe('Webshops offline', () => {
    let organization: Organization;
    let period: RegistrationPeriod;
    let user: User;
    let webshop: Webshop;

    test.beforeAll(async () => {
            user = WorkerData.user;
            user.permissions = UserPermissions.create({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            });
            await user.save();
                    
            organization = await new OrganizationFactory({
                name: `Vereniging${WorkerData.id}`,
            }).create();

            organization.meta.recordsConfiguration.financialSupport = true;
            organization.meta.recordsConfiguration.uitpasNumber
                = new PropertyFilter(null, null);
            await organization.save();

            period = await new RegistrationPeriodFactory({
                startDate: new Date('2000-01-01'),
                endDate: new Date('2001-01-01'),
                organization,
            }).create();

            organization.periodId = period.id;
            await organization.save();
    
            // webshop
            webshop = (await TestWebshops.webshopWithTicketsAndSeatingPlan({organization, seatCount: 35})).webshop;
        });

    test.afterAll(async () => {
        await WorkerData.resetDatabase();
    });

    test('Should be able to manually scan order if no internet', async ({browser, storageState}) => {
        const context = await browser.newContext({
            storageState,
            ...devices['iPhone 13'],
            userAgent: undefined,
        });

        test.setTimeout(120_000);

        const page = await context.newPage();
        const dashboard = new DashboardPage(page);

        await test.step('place orders while online', async () => {
            
            await dashboard.goto();
            await dashboard.openOrganizationDashboard({organizationUri: organization.uri});
            await dashboard.openTab(DashboardTab.Webshops);

            // open webshop overview
            await page.getByTestId(`webshop-menu-item`)
                .filter({ hasText: webshop.meta.name })
                .click();

            // open orders
            await page.getByTestId('open-orders-button').click();

            // add order
            const ordersView = new WebshopOrdersView(page);
            await ordersView.waitForFirstRow();

            // place some orders
            const ordersCount = 2;

            for (let i = 0; i < ordersCount; i++) {

                await ordersView.addOrder({
                    firstName: 'John',
                    lastName: 'Doe-'+i,
                    email: `john.doe-${i}@test.be`,
                    product: webshop.products[0],
                    // point of sale to make sure tickets are added immediately
                    paymentMethod: PaymentMethod.PointOfSale
                });
            }
        });

        // go to start
        await dashboard.openOrganizationDashboard({organizationUri: organization.uri});

        // mock offline behaviour
        await simulateNetworkOffline(page);

        await test.step('open webshop orders', async () => {
            await dashboard.openTab(DashboardTab.Webshops);
        
            await page.getByTestId(`webshop-menu-item`)
                .filter({ hasText: webshop.meta.name })
                .click();

            // open orders
            await page.getByTestId('open-orders-button').click();
        });

        const table = new TableHelper(page);

        await test.step('open order detail', async () => {
            const row = table.getRow('John Doe-0');
            await row.click();

            const orderView = page.getByTestId('order-view');

            // should be able to see correct details, such as the email
            await expect(orderView).toContainText('john.doe-0@test.be');
        });

        await test.step('open ticket', async () => {
            const ticketsButton = page.getByTestId('tickets-button');
            await ticketsButton.click();

            const ticketRow = page.getByTestId('ticket-row');
            await ticketRow.click();

            const validTicketView = page.getByTestId('valid-ticket-view');
            await expect(validTicketView).toContainText($t('%WA'));
        });

        await test.step('scan ticket', async () => {
            const scanButton = page.getByTestId('scan-button');
            await scanButton.click();

            // click ticket again
            const ticketRow = page.getByTestId('ticket-row');
            await ticketRow.click();

            const ticketAlreadyScannedView = page.getByTestId('ticket-already-scanned-view');
            await expect(ticketAlreadyScannedView).toBeVisible();
        });
    });

    test.skip('Should be able to scan orders if no internet', async ({page, pages}) => {
        throw new Error('Not implemented yet');
    });
});

