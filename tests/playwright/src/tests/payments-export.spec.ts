// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Download, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import type { Group, Member, Organization, User } from '@stamhoofd/models';
import { BalanceItemFactory, BalanceItemPayment, GroupFactory, MemberFactory, Order, OrganizationFactory, Payment, RegistrationFactory, UserFactory } from '@stamhoofd/models';
import {
    appToUri,
    BalanceItemRelation,
    BalanceItemRelationType,
    BalanceItemType,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    PaymentType,
    PermissionLevel,
    Permissions,
    STPackageBundle,
    Token as TokenStruct,
    TranslatedString,
    Version,
} from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { readFile } from 'node:fs/promises';
import XLSX from 'xlsx';
import { WebshopOrderFlow } from '../flows/WebshopOrderFlow.js';
import { DashboardPage, DashboardTab, TableHelper, WorkerData } from '../helpers/index.js';
import { WebshopOrdersView } from '../helpers/page/webshop/WebshopOrdersView.js';
import { TestWebshops } from '../helpers/test-data/TestWebshops.js';

type Row = (string | number | Date | undefined)[];

async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await SessionService.createSession(user);
    const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));

    const organizationId = user.organizationId;
    await page.addInitScript(({ organizationId, tokenString }) => {
        if (organizationId) {
            window.localStorage.setItem('token-' + organizationId, tokenString);
        } else {
            window.localStorage.setItem('token-platform', tokenString);
        }
    }, { organizationId, tokenString });
}

async function createOrganization(): Promise<Organization> {
    const organization = await new OrganizationFactory({
        name: `PaymentsExport${WorkerData.id}`,
        // Webshops only: with the members package the dashboard shows a second 'Meer' button, which the dashboard helper can't tell apart
        packages: [STPackageBundle.Webshops],
    }).create();
    await STPackageService.updateOrganizationPackages(organization.id);
    return organization;
}

/** A registration that was paid at the desk, next to the webshop orders: a payment without an order. */
async function createPaidRegistration({ organization, member, group, price }: { organization: Organization; member: Member; group: Group; price: number }) {
    const registration = await new RegistrationFactory({ member, group }).create();

    const balanceItem = await new BalanceItemFactory({
        organizationId: organization.id,
        memberId: member.id,
        registrationId: registration.id,
        type: BalanceItemType.Registration,
        amount: 1,
        unitPrice: price,
        pricePaid: price,
        relations: new Map([
            [BalanceItemRelationType.Member, BalanceItemRelation.create({ id: member.id, name: new TranslatedString(member.details.name) })],
            [BalanceItemRelationType.Group, BalanceItemRelation.create({ id: group.id, name: group.settings.name })],
        ]),
    }).create();

    const payment = new Payment();
    payment.organizationId = organization.id;
    payment.method = PaymentMethod.PointOfSale;
    payment.status = PaymentStatus.Succeeded;
    payment.type = PaymentType.Payment;
    payment.price = price;
    payment.paidAt = new Date();
    await payment.save();

    const balanceItemPayment = new BalanceItemPayment();
    balanceItemPayment.balanceItemId = balanceItem.id;
    balanceItemPayment.paymentId = payment.id;
    balanceItemPayment.organizationId = organization.id;
    balanceItemPayment.price = price;
    await balanceItemPayment.save();

    return payment;
}

async function openWebshopOrders(adminPage: Page, organization: Organization, webshopName: string) {
    const dashboard = new DashboardPage(adminPage);
    await dashboard.openOrganizationDashboard({ organizationUri: organization.uri });
    await dashboard.openTab(DashboardTab.Webshops);
    await adminPage.getByTestId('webshop-menu-item').filter({ hasText: webshopName }).click();
    await adminPage.getByTestId('open-orders-button').click();
    await adminPage.getByTestId('table').waitFor();
}

/** Deleting a paid order asks to acknowledge the financial consequences, then to confirm the deletion. */
async function deleteOrder(adminPage: Page, customerName: string) {
    const table = new TableHelper(adminPage);
    await table.waitForFirstRow();

    // The table keeps the selection of the previous action
    const selectAll = adminPage.getByTestId('table-head').locator('input[type="checkbox"]');
    if (await selectAll.isChecked()) {
        await table.toggleSelectAllRows();
    }
    await table.toggleSelectRow(customerName);
    await table.clickAction('Verwijderen');

    // The financial warning is only shown when the table already knows the order was paid
    const dialog = adminPage.getByTestId('centered-message');
    await expect(dialog.first()).toBeVisible();
    const warning = dialog.filter({ hasText: 'vertekend beeld' });
    if (await warning.count() > 0) {
        await warning.getByRole('button', { name: 'Begrepen' }).click();
    }

    const confirmation = adminPage.getByTestId('centered-message').filter({ hasText: `(${customerName}) verwijderen?` });
    await confirmation.getByText('Ja, ik begrijp het').click();
    await confirmation.getByRole('button', { name: 'Verwijderen' }).click();
    await expect(adminPage.getByText('Bestelling verwijderd')).toBeVisible();
}

async function readWorkbook(download: Download, saveAsPath: string): Promise<XLSX.WorkBook> {
    expect(await download.failure()).toBeNull();
    await download.saveAs(saveAsPath);
    return XLSX.read(await readFile(saveAsPath), { cellDates: true });
}

/** The header row is the first row that names the id column; a category row can sit above it. */
function getSheet(workbook: XLSX.WorkBook, sheetName: string): { headers: Row; data: Row[] } {
    const sheet = workbook.Sheets[sheetName];
    expect(sheet, `Expected sheet ${sheetName} to exist`).toBeDefined();
    const rows = XLSX.utils.sheet_to_json<Row>(sheet, { header: 1 });
    const headerIndex = rows.findIndex(row => row.includes('ID') || row.includes('Betaling ID'));
    expect(headerIndex, `Expected a header row on sheet ${sheetName}`).toBeGreaterThanOrEqual(0);
    return {
        headers: rows[headerIndex],
        data: rows.slice(headerIndex + 1).filter(row => row.length > 0),
    };
}

function getCell(headers: Row, row: Row, header: string): string | number | Date | undefined {
    const index = headers.indexOf(header);
    expect(index, `Expected column ${header} to exist`).toBeGreaterThanOrEqual(0);
    return row[index];
}

test.describe('Payments Excel export @payments-export', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test('exports every payment with the order it paid for, split into the articles that were ordered', async ({ page, browser }) => {
        // A customer order, two dashboard round trips and a server-side export
        test.setTimeout(120_000);

        const organization = await createOrganization();
        const { webshop } = await TestWebshops.create({
            organization,
            name: `Wafelverkoop ${WorkerData.id}`,
            productCount: 2,
            paymentMethods: [PaymentMethod.Transfer, PaymentMethod.PointOfSale],
        });

        // Jane orders two of the first product and one of the second, and pays by transfer
        const flow = new WebshopOrderFlow(page, { cartEnabled: true });
        await flow.goto(WorkerData.urls.webshopUri(webshop.uri));
        await flow.addProduct('Product 1', { count: 2 });
        await flow.addProduct('Product 2');
        await flow.goToCheckout();
        await flow.fillCustomer({ firstName: 'Jane', lastName: 'Janssens', email: 'jane@test.be' });
        await flow.selectPaymentMethod('verschrijving');
        await flow.confirmPayment();
        await flow.expectTransferInstructions();

        const [janeOrder] = await Order.where({ webshopId: webshop.id });
        expect(janeOrder.number).not.toBeNull();

        // Eva paid her registration at the desk
        const kapoenen = await new GroupFactory({ organization, name: new TranslatedString('Kapoenen'), price: 40_0000 }).create();
        const eva = await new MemberFactory({ organization, firstName: 'Eva', lastName: 'Peeters' }).create();
        const registrationPayment = await createPaidRegistration({ organization, member: eva, group: kapoenen, price: 40_0000 });

        const admin = await new UserFactory({
            email: `admin-payments-export-${WorkerData.id}-${Date.now()}@test.be`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        await loginAs({ page: adminPage, user: admin });
        await openWebshopOrders(adminPage, organization, webshop.meta.name);

        // Bob paid at the desk, so his order is paid right away. The admin marks Jane's transfer as received.
        const ordersView = new WebshopOrdersView(adminPage);
        await ordersView.addOrder({
            firstName: 'Bob',
            lastName: 'Peeters',
            email: 'bob@test.be',
            product: webshop.products[1],
            amount: 1,
            paymentMethod: PaymentMethod.PointOfSale,
        });
        await ordersView.markAllOrdersPaid();

        // Bob's order is deleted afterwards: the money stays, the order number does not
        await deleteOrder(adminPage, 'Bob Peeters');
        const bobOrder = (await Order.where({ webshopId: webshop.id })).find(order => order.id !== janeOrder.id)!;
        expect(bobOrder.status).toBe(OrderStatus.Deleted);

        // Boekhouding > Betalingen: export all payments
        await adminPage.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}/boekhouding/betalingen`);
        const table = new TableHelper(adminPage);
        await table.waitForFirstRow();
        await expect(table.getRow('Jane')).toHaveCount(1);
        await table.toggleSelectAllRows();
        await table.clickAction('Exporteer naar Excel');

        // One sheet per payment, one sheet per paid line, both with an order number column
        const exportView = adminPage.getByTestId('save-view').filter({ has: adminPage.getByRole('heading', { name: 'Exporteren naar Excel' }) });
        await expect(exportView.getByRole('button', { name: 'Betalingen' })).toBeVisible();
        await expect(exportView.getByText('Het nummer van de webshopbestelling die werd betaald (indien van toepassing)')).toBeVisible();
        await exportView.getByRole('button', { name: 'Betaallijnen' }).click();
        await expect(exportView.getByText('Het nummer van de webshopbestelling waarvoor deze lijn werd betaald (indien van toepassing)')).toBeVisible();

        await exportView.getByTestId('save-button').click();

        // The file is prepared on the server and offered in a toast
        const downloadPromise = adminPage.waitForEvent('download');
        await adminPage.locator('.toast-view').filter({ hasText: 'Downloaden' }).click();
        const workbook = await readWorkbook(await downloadPromise, test.info().outputPath('payments.xlsx'));
        expect(workbook.SheetNames).toEqual(['Betalingen', 'Betaallijnen']);

        // Sheet 1: one row per payment
        const payments = getSheet(workbook, 'Betalingen');
        expect(payments.headers).toEqual(expect.arrayContaining(['ID', 'Prijs', 'Betaalstatus', 'Betaalmethode', 'Bestelnummer', 'Detail']));
        expect(payments.data).toHaveLength(3);

        const janePayment = payments.data.find(row => getCell(payments.headers, row, 'Bestelnummer') === janeOrder.number)!;
        expect(janePayment, 'Expected a payment row with the order number of Jane').toBeDefined();
        expect(getCell(payments.headers, janePayment, 'Prijs')).toBe(45);
        expect(getCell(payments.headers, janePayment, 'Betaalstatus')).toBe('Ontvangen');
        expect(getCell(payments.headers, janePayment, 'Betaalmethode')).toBe('Overschrijving');

        const bobPayment = payments.data.find(row => getCell(payments.headers, row, 'Bestelnummer') === 'Verwijderd')!;
        expect(bobPayment, 'Expected a payment row of the deleted order').toBeDefined();
        expect(getCell(payments.headers, bobPayment, 'Prijs')).toBe(15);
        expect(getCell(payments.headers, bobPayment, 'Betaalmethode')).toBe('Ter plaatse');

        const evaPayment = payments.data.find(row => getCell(payments.headers, row, 'ID') === registrationPayment.id)!;
        expect(evaPayment, 'Expected a payment row of the registration').toBeDefined();
        expect(getCell(payments.headers, evaPayment, 'Prijs')).toBe(40);
        expect(getCell(payments.headers, evaPayment, 'Bestelnummer') ?? '').toBe('');

        // Sheet 2: Jane's order is split into the two articles, Bob's deleted order and Eva's registration are one line each
        const lines = getSheet(workbook, 'Betaallijnen');
        expect(lines.headers).toEqual(expect.arrayContaining(['Betaling ID', 'Type', 'Categorie', 'Titel', 'Beschrijving', 'Bestelnummer', 'Aantal', 'Eenheidsprijs', 'Prijs']));
        expect(lines.data).toHaveLength(4);

        const janeLines = lines.data.filter(row => getCell(lines.headers, row, 'Betaling ID') === getCell(payments.headers, janePayment, 'ID'));
        expect(janeLines.map(row => getCell(lines.headers, row, 'Titel')).sort()).toEqual(['Product 1', 'Product 2']);
        for (const row of janeLines) {
            expect(getCell(lines.headers, row, 'Bestelnummer')).toBe(janeOrder.number);
            expect(getCell(lines.headers, row, 'Type')).toBe('Webshopbestelling');
            expect(getCell(lines.headers, row, 'Categorie')).toBe(webshop.meta.name);
        }
        const productOne = janeLines.find(row => getCell(lines.headers, row, 'Titel') === 'Product 1')!;
        expect(getCell(lines.headers, productOne, 'Aantal')).toBe(2);
        expect(getCell(lines.headers, productOne, 'Eenheidsprijs')).toBe(15);
        expect(getCell(lines.headers, productOne, 'Prijs')).toBe(30);

        const bobLine = lines.data.find(row => getCell(lines.headers, row, 'Bestelnummer') === 'Verwijderd')!;
        expect(bobLine, 'Expected a line of the deleted order').toBeDefined();
        expect(getCell(lines.headers, bobLine, 'Betaling ID')).toBe(getCell(payments.headers, bobPayment, 'ID'));
        expect(getCell(lines.headers, bobLine, 'Prijs')).toBe(15);

        const evaLine = lines.data.find(row => getCell(lines.headers, row, 'Betaling ID') === registrationPayment.id)!;
        expect(evaLine, 'Expected a line of the registration').toBeDefined();
        expect(getCell(lines.headers, evaLine, 'Type')).toBe('Inschrijving');
        expect(getCell(lines.headers, evaLine, 'Categorie')).toBe('Kapoenen');
        expect(getCell(lines.headers, evaLine, 'Prijs')).toBe(40);
        expect(getCell(lines.headers, evaLine, 'Bestelnummer') ?? '').toBe('');

        await adminContext.close();
    });
});
