// test should always be imported first
import { test } from '../test-fixtures/platform.js';

// other imports
import { devices } from '@playwright/test';
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
import { PermissionLevel, Permissions, PropertyFilter, UserPermissions } from '@stamhoofd/structures';
import {
    DashboardPage,
    DashboardTab,
    WorkerData
} from '../helpers/index.js';
import { WebshopOrdersView } from '../helpers/page/webshop/WebshopOrdersView.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

// does not work currently -> fails to load module
test.describe.skip('Webshops offline', () => {
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
                });
            }
        });

        // todo: does not work currently -> fails to load module
        await page.reload();
        await dashboard.openOrganizationDashboard({organizationUri: organization.uri});
        await context.setOffline(true);

        await dashboard.openTab(DashboardTab.Webshops);

        // open webshop overview
        await page.getByTestId(`webshop-menu-item`)
            .filter({ hasText: webshop.meta.name })
            .click();

        // open orders
        await page.getByTestId('open-orders-button').click();

        // await test.step('open dashboard', async () => {
        //     throw new Error('Not implemented yet');
        // });

        // await test.step('open webshop orders', async () => {
        //     throw new Error('Not implemented yet');
        // });

        // await test.step('open webshop detail', async () => {
        //     throw new Error('Not implemented yet');
        // });

        // await test.step('open ticket', async () => {
        //     throw new Error('Not implemented yet');
        // });

        // await test.step('scan ticket', async () => {
        //     throw new Error('Not implemented yet');
        // });
    });

    test.skip('Should be able to scan orders if no internet', async ({page, pages}) => {
        throw new Error('Not implemented yet');
    });
});
