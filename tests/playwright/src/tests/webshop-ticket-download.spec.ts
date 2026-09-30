// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { Organization, OrderFactory, OrganizationFactory, TicketFactory } from '@stamhoofd/models';
import { Cart, CartItem, Customer, OrderData, STPackageBundle, WebshopTicketType } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { readFile } from 'node:fs/promises';
import { WorkerData } from '../helpers/index.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

test.describe('Webshop ticket download @webshop-ticket-download', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test('A customer can download the tickets of an order as a PDF', async ({ page }) => {
        const organization = await new OrganizationFactory({
            name: `TicketDownload${WorkerData.id}`,
            packages: [STPackageBundle.Webshops],
        }).create();

        // Recalculate meta.packages so the public webshop is not rendered as "closed"
        await STPackageService.updateOrganizationPackages(organization.id);
        const refreshed = (await Organization.getByID(organization.id))!;

        const { webshop } = await TestWebshops.create({
            organization: refreshed,
            name: `Ticket download ${WorkerData.id}`,
            ticketType: WebshopTicketType.SingleTicket,
            cartEnabled: false,
        });

        // Without a payment the order counts as paid, so the tickets are shown
        const product = webshop.products[0];
        const order = await new OrderFactory({
            webshop,
            data: OrderData.create({
                customer: Customer.create({ firstName: 'Ticket', lastName: 'Holder', email: 'ticket.holder@example.com' }),
                // Tickets without cart items are skipped in the PDF
                cart: Cart.create({ items: [CartItem.create({ product, productPrice: product.prices[0], amount: 1 })] }),
            }),
        }).create();
        await new TicketFactory({ order }).create();

        const pageErrors: Error[] = [];
        page.on('pageerror', error => pageErrors.push(error));

        await page.goto(WorkerData.urls.webshopUri(webshop.uri) + '/order/' + order.id);
        await expect(page.getByTestId('tickets-section')).toBeVisible();

        const downloadPromise = page.waitForEvent('download');
        await page.getByTestId('download-tickets-button').click();
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toMatch(/\.pdf$/);

        const pdf = (await readFile(await download.path())).toString('latin1');
        expect(pdf.startsWith('%PDF-')).toBe(true);
        expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
        // The ticket is rendered with the embedded Metropolis font
        expect(pdf).toContain('Metropolis-Medium');

        expect(pageErrors).toEqual([]);
    });
});
