// test should always be imported first
import { setup, test } from '../test-fixtures/platform.js';
setup();

// other imports
import { expect } from '@playwright/test';
import type { Order, Organization, Webshop } from '@stamhoofd/models';
import { OrderFactory, OrganizationFactory, RegistrationPeriodFactory, TicketFactory } from '@stamhoofd/models';
import { Cart, CartItem, CartItemPrice, Customer, OrderData, PermissionLevel, Permissions, UserPermissions, WebshopTicketType } from '@stamhoofd/structures';
import { DashboardPage, DashboardTab, WorkerData } from '../helpers/index.js';
import { WebshopStatisticsView } from '../helpers/page/webshop/WebshopStatisticsView.js';
import { simulateNetworkOffline } from '../helpers/simulateNetworkOffline.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

/** € 15,00 per product */
const productPrice = 15_0000;

test.describe('Webshop statistics offline', () => {
    let organization: Organization;
    let webshop: Webshop;

    /**
     * An order with `amount` times the first product of the webshop, and a ticket for that order
     * (the webshop creates one ticket per order).
     */
    async function createOrderWithTicket({ amount, scanned }: { amount: number; scanned: boolean }): Promise<Order> {
        const product = webshop.products[0];

        const order = await new OrderFactory({
            webshop,
            data: OrderData.create({
                customer: Customer.create({
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john.doe@example.com',
                }),
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product,
                            productPrice: product.prices[0],
                            amount,
                            calculatedPrices: [CartItemPrice.create({ price: productPrice * amount })],
                        }),
                    ],
                }),
            }),
        }).create();

        const ticket = await new TicketFactory({ order }).create();

        if (scanned) {
            ticket.scannedAt = new Date();
            await ticket.save();
        }

        return order;
    }

    /**
     * The totals of the 3 sold products, spread over 2 orders, of which one ticket is scanned.
     */
    async function expectStatistics(statistics: WebshopStatisticsView) {
        await expect(statistics.ordersCount).toHaveText('2');
        await expect(statistics.averageOrderPrice).toHaveText('€ 22,50 / bestelling');
        await expect(statistics.ticketsCount).toHaveText('2');
        await expect(statistics.scannedTicketsCount).toHaveText('1 gescand');
        await expect(statistics.getProductAmount('Product 1')).toHaveText('3');

        // total revenue of the 'Omzet' graph
        await expect(statistics.graphTotal).toHaveText('€ 45');
    }

    test.beforeAll(async () => {
        const user = WorkerData.user;
        user.permissions = UserPermissions.create({
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        });
        await user.save();

        organization = await new OrganizationFactory({
            name: `Vereniging${WorkerData.id}`,
        }).create();

        const period = await new RegistrationPeriodFactory({
            startDate: new Date('2000-01-01'),
            endDate: new Date('2001-01-01'),
            organization,
        }).create();

        organization.periodId = period.id;
        await organization.save();

        webshop = (await TestWebshops.create({
            organization,
            ticketType: WebshopTicketType.SingleTicket,
            price: productPrice,
        })).webshop;

        await createOrderWithTicket({ amount: 2, scanned: true });
        await createOrderWithTicket({ amount: 1, scanned: false });
    });

    test.afterAll(async () => {
        await WorkerData.resetDatabase();
    });

    test('Should calculate the statistics from the offline cache if there is no internet', async ({ page }) => {
        test.setTimeout(120_000);

        const dashboard = new DashboardPage(page);
        const statistics = new WebshopStatisticsView(page);

        await test.step('open the statistics while online', async () => {
            await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
            await dashboard.openTab(DashboardTab.Webshops);

            await page.getByTestId('webshop-menu-item')
                .filter({ hasText: webshop.meta.name })
                .click();

            await page.getByTestId('open-statistics-button').click();

            // fetching the orders and tickets also stores them in the local database
            await expectStatistics(statistics);

            await statistics.close();
        });

        // mock offline behaviour
        await simulateNetworkOffline(page);

        await test.step('open the statistics without internet', async () => {
            await page.getByTestId('open-statistics-button').click();

            // the orders and tickets cannot be updated
            await expect(statistics.fetchErrorToast).toContainText($t('%ge'));

            // but they are still streamed from the local database
            await expectStatistics(statistics);
        });
    });
});
