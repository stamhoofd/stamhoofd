// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import type { User } from '@stamhoofd/models';
import { Organization, OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { PaymentMethod, PermissionLevel, Permissions, STPackageBundle, Token as TokenStruct, Version, WebshopTicketType } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WebshopOrderFlow } from '../flows/WebshopOrderFlow.js';
import { DashboardPage, DashboardTab, WorkerData } from '../helpers/index.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await Token.createToken(user);
    const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
    const organizationId = user.organizationId;

    await page.addInitScript(({ organizationId, tokenString }) => {
        if (organizationId) {
            window.localStorage.setItem('token-' + organizationId, tokenString);
        }
        else {
            window.localStorage.setItem('token-platform', tokenString);
        }
    }, { organizationId, tokenString });
}

test.describe('Webshop seating overview (organization mode) @webshop-seating', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test('The seating overview keeps drawing the seats while the webshop is reloaded', async ({ page, browser }) => {
        const organization = await new OrganizationFactory({
            name: `SeatShop${WorkerData.id}`,
            packages: [STPackageBundle.Webshops],
        }).create();

        // Recalculate meta.packages so the public webshop is not rendered as "closed"
        await STPackageService.updateOrganizationPackages(organization.id);
        const refreshed = (await Organization.getByID(organization.id))!;

        const { webshop } = await TestWebshops.create({
            organization: refreshed,
            name: `Seat shop ${WorkerData.id}`,
            ticketType: WebshopTicketType.Tickets,
            productCount: 1,
            cartEnabled: false,
            withSeatingPlan: true,
            price: 0,
            paymentMethods: [PaymentMethod.PointOfSale],
        });

        const seatCount = webshop.meta.seatingPlans[0].sections[0].rows.flatMap(row => row.seats).length;

        // A customer orders two seats, so the seating overview also has an order to load
        const flow = new WebshopOrderFlow(page, { cartEnabled: false });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.addProduct('Product 1', { seats: 2 });
        await flow.goToCheckout();
        await flow.fillCustomer();
        await flow.confirmPayment();
        await flow.expectTicketsDownloadable();

        // The admin opens the seating overview of the webshop
        const admin = await new UserFactory({
            email: `admin-${WorkerData.id}-${Date.now()}@test.be`,
            organization: refreshed,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        await loginAs({ page: adminPage, user: admin });

        const dashboard = new DashboardPage(adminPage);
        await dashboard.openOrganizationDashboard({ organizationUri: refreshed.uri });
        await dashboard.openTab(DashboardTab.Webshops);
        await adminPage.getByTestId('webshop-menu-item').filter({ hasText: webshop.meta.name }).click();
        await adminPage.getByRole('heading', { name: 'Zaaloverzicht' }).click();

        const seats = adminPage.getByTestId('seat-button');
        await expect(seats.first()).toBeVisible();

        // Loading the orders reloads the webshop in the background, which replaces the rows and seats
        // of the seating plan with newly decoded ones. The seats should keep their size and position.
        await adminPage.waitForTimeout(3000);

        const boxes = await seats.evaluateAll(elements => elements.map((element) => {
            const { width, height, x, y } = element.getBoundingClientRect();
            return { width, height, x, y };
        }));

        expect(boxes.length).toBe(seatCount);

        for (const box of boxes) {
            expect(box.width).toBeGreaterThan(10);
            expect(box.height).toBeGreaterThan(10);
        }

        // No two seats are drawn on top of each other
        const positions = new Set(boxes.map(box => `${box.x}x${box.y}`));
        expect(positions.size).toBe(boxes.length);

        await adminContext.close();
    });
});
