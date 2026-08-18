// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import type { BalanceItem, Group, Member, Organization, User, Webshop } from '@stamhoofd/models';
import { BalanceItemFactory, BalanceItemPayment, GroupFactory, MemberFactory, OrderFactory, OrganizationFactory, OrganizationRegistrationPeriodFactory, Payment, RegistrationFactory, RegistrationPeriod, Token, UserFactory, WebshopFactory } from '@stamhoofd/models';
import {
    appToUri,
    BalanceItemRelation,
    BalanceItemRelationType,
    BalanceItemType,
    GroupCategory,
    GroupCategorySettings,
    PaymentMethod,
    PaymentProvider,
    PaymentStatus,
    PaymentType,
    PermissionLevel,
    Permissions,
    SettlementReference,
    STPackageBundle,
    Token as TokenStruct,
    TransferSettings,
    TranslatedString,
    Version,
} from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { TableHelper, WorkerData } from '../helpers/index.js';

async function loginAs({ page, user }: { page: Page; user: User }) {
    const token = await Token.createToken(user);
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

test.describe('Payment breakdown (organization mode) @payment-breakdown', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    async function createOrganization(name: string, packages: STPackageBundle[] = [STPackageBundle.Members]): Promise<Organization> {
        const organization = await new OrganizationFactory({
            name,
            packages,
        }).create();

        await organization.save();

        await STPackageService.updateOrganizationPackages(organization.id);

        return organization;
    }

    /**
     * Noon on a day of the current month. The export starts out on the current month, so only days of
     * that month end up in the breakdown, no matter which day of the month the test runs on.
     */
    function dayOfMonth(day: number): Date {
        const date = new Date();
        date.setDate(day);
        date.setHours(12, 0, 0, 0);
        return date;
    }

    async function createPaidRegistration({ organization, member, group, price, priceName, method, iban, paidAt, provider, settlement }: {
        organization: Organization;
        member: Member;
        group: Group;
        price: number;
        priceName?: string;
        method: PaymentMethod;
        iban?: string;
        /**
         * When the money was received, so a breakdown has something to show over time.
         */
        paidAt?: Date;
        provider?: PaymentProvider;
        /**
         * The payout of the provider this payment was part of.
         */
        settlement?: SettlementReference;
    }): Promise<BalanceItem> {
        const registration = await new RegistrationFactory({ member, group }).create();

        const relations = new Map([
            [BalanceItemRelationType.Member, BalanceItemRelation.create({ id: member.id, name: new TranslatedString(member.details.name) })],
            [BalanceItemRelationType.Group, BalanceItemRelation.create({ id: group.id, name: group.settings.name })],
        ]);

        if (priceName) {
            relations.set(
                BalanceItemRelationType.GroupPrice,
                BalanceItemRelation.create({ id: 'price-' + priceName, name: new TranslatedString(priceName) }),
            );
        }

        const balanceItem = await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: member.id,
            registrationId: registration.id,
            type: BalanceItemType.Registration,
            amount: 1,
            unitPrice: price,
            pricePaid: price,
            relations,
        }).create();

        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = method;
        payment.status = PaymentStatus.Succeeded;
        payment.type = PaymentType.Payment;
        payment.price = price;
        payment.paidAt = paidAt ?? new Date();
        payment.provider = provider ?? null;
        payment.settlement = settlement ?? null;

        if (iban) {
            payment.transferSettings = TransferSettings.create({ iban, creditor: 'Hoofdrekening' });
        }

        await payment.save();

        const balanceItemPayment = new BalanceItemPayment();
        balanceItemPayment.balanceItemId = balanceItem.id;
        balanceItemPayment.paymentId = payment.id;
        balanceItemPayment.organizationId = organization.id;
        balanceItemPayment.price = price;
        await balanceItemPayment.save();

        return balanceItem;
    }

    async function createPaidOrder({ organization, webshop, price, paidAt }: {
        organization: Organization;
        webshop: Webshop;
        price: number;
        /**
         * When the money was received, so a breakdown has something to show over time.
         */
        paidAt?: Date;
    }): Promise<BalanceItem> {
        const order = await new OrderFactory({ webshop }).create();

        const balanceItem = await new BalanceItemFactory({
            organizationId: organization.id,
            orderId: order.id,
            type: BalanceItemType.Order,
            amount: 1,
            unitPrice: price,
            pricePaid: price,
            relations: new Map([
                [BalanceItemRelationType.Webshop, BalanceItemRelation.create({ id: webshop.id, name: new TranslatedString(webshop.meta.name) })],
            ]),
        }).create();

        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = PaymentMethod.PointOfSale;
        payment.status = PaymentStatus.Succeeded;
        payment.type = PaymentType.Payment;
        payment.price = price;
        payment.paidAt = paidAt ?? new Date();
        payment.createdAt = paidAt ?? new Date();
        await payment.save();

        const balanceItemPayment = new BalanceItemPayment();
        balanceItemPayment.balanceItemId = balanceItem.id;
        balanceItemPayment.paymentId = payment.id;
        balanceItemPayment.organizationId = organization.id;
        balanceItemPayment.price = price;
        await balanceItemPayment.save();

        return balanceItem;
    }

    test('an admin sees who received the money, per category and per article, and can narrow down', async ({ page }) => {
        const organization = await createOrganization(`PaymentBreakdown${WorkerData.id}`);

        const kapoenen = await new GroupFactory({ organization, name: new TranslatedString('Kapoenen'), price: 40_0000 }).create();
        const welpen = await new GroupFactory({ organization, name: new TranslatedString('Welpen'), price: 25_0000 }).create();

        const first = await new MemberFactory({ organization, firstName: 'Eva', lastName: 'Peeters' }).create();
        const second = await new MemberFactory({ organization, firstName: 'Jonas', lastName: 'Claes' }).create();
        const third = await new MemberFactory({ organization, firstName: 'Marie', lastName: 'Willems' }).create();

        // Kapoenen: 40 euro standard and 20 euro reduced (60 in total), Welpen: 2 x 25 euro, received on four different days
        await createPaidRegistration({ organization, member: first, group: kapoenen, price: 40_0000, priceName: 'Standaardtarief', method: PaymentMethod.Transfer, iban: 'BE68539007547034', paidAt: dayOfMonth(1) });
        await createPaidRegistration({ organization, member: second, group: kapoenen, price: 20_0000, priceName: 'Verminderd tarief', method: PaymentMethod.PointOfSale, paidAt: dayOfMonth(2) });
        await createPaidRegistration({ organization, member: second, group: welpen, price: 25_0000, priceName: 'Standaardtarief', method: PaymentMethod.Transfer, iban: 'BE68539007547034', paidAt: dayOfMonth(3) });
        await createPaidRegistration({ organization, member: third, group: welpen, price: 25_0000, priceName: 'Standaardtarief', method: PaymentMethod.Transfer, iban: 'BE68539007547034', paidAt: dayOfMonth(4) });

        const admin = await new UserFactory({
            email: `admin-breakdown-${WorkerData.id}-${Date.now()}@test.be`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        await loginAs({ page, user: admin });

        // Boekhouding > Betalingen exporteren
        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}/boekhouding/exporteren`);

        const configureView = page.getByTestId('save-view').filter({ hasText: 'Statistieken en totalen berekenen' });
        await expect(configureView).toBeVisible();
        await configureView.getByTestId('save-button').click();

        // Views stay in the navigation stack, so we always look at the one on top
        const breakdownView = page.getByTestId('save-view').last();

        // Everything the payments of the selected period add up to
        await expect(breakdownView.getByText('Totaal').first()).toBeVisible();
        await expect(breakdownView.getByText(/€\s*110\b/).first()).toBeVisible();

        // What came in over time, per day: everything that was received falls in one week
        const graph = breakdownView.getByTestId('breakdown-graph');
        await expect(graph).toBeVisible();
        await expect(graph.getByText(/€\s*110\b/)).toBeVisible();

        // Only a few days are selected, so there is no shorter period to zoom in on
        await expect(graph.getByRole('button', { name: 'Volledige periode' })).toHaveCount(0);

        // Tab 1: where the money arrived. Transfers are grouped per bank account.
        await expect(breakdownView.getByRole('heading', { name: 'Hoofdrekening' })).toBeVisible();
        await expect(breakdownView.getByText('BE68539007547034').first()).toBeVisible();
        await expect(breakdownView.getByText(/€\s*90\b/).first()).toBeVisible();

        // Tab 2: what it was for
        await breakdownView.getByRole('button', { name: 'Categorie', exact: true }).click();
        await expect(breakdownView.getByRole('heading', { name: 'Kapoenen' })).toBeVisible();
        await expect(breakdownView.getByRole('heading', { name: 'Welpen' })).toBeVisible();
        await expect(breakdownView.getByText(/€\s*60\b/).first()).toBeVisible();

        // Tab 3: the articles. The two members that registered for Welpen are one row.
        await breakdownView.getByRole('button', { name: 'Artikels', exact: true }).click();
        await expect(breakdownView.getByText('Verminderd tarief').first()).toBeVisible();
        const welpenArticle = breakdownView.getByTestId('breakdown-row').filter({ hasText: 'Inschrijving voor Welpen' });
        await expect(welpenArticle).toHaveCount(1);
        await expect(welpenArticle.getByText(/€\s*50\b/)).toBeVisible();

        // Narrow down to one category: only that group is left
        await breakdownView.getByRole('button', { name: 'Categorie', exact: true }).click();
        await breakdownView.getByRole('heading', { name: 'Kapoenen' }).click();

        const narrowedView = page.getByTestId('save-view').last();
        await expect(narrowedView.getByText(/€\s*60\b/).first()).toBeVisible();
        await expect(narrowedView.getByText('Welpen')).toHaveCount(0);

        // The category tab is gone: it would only repeat the category that was opened
        await expect(narrowedView.getByRole('button', { name: 'Categorie', exact: true })).toHaveCount(0);

        // Within one category the articles are the interesting part: both prices of this group
        await narrowedView.getByRole('button', { name: 'Artikels', exact: true }).click();
        await expect(narrowedView.getByText('Standaardtarief').first()).toBeVisible();
        await expect(narrowedView.getByText('Verminderd tarief').first()).toBeVisible();

        // From here the selection can be exported to Excel
        await narrowedView.getByTestId('save-button').click();
        await expect(page.getByText('Exporteren naar Excel').first()).toBeVisible();
    });

    test('an admin sees which payout the money was part of, and can narrow down to one', async ({ page }) => {
        const organization = await createOrganization(`SettlementBreakdown${WorkerData.id}`);

        const kapoenen = await new GroupFactory({ organization, name: new TranslatedString('Kapoenen'), price: 40_0000 }).create();

        const first = await new MemberFactory({ organization, firstName: 'Eva', lastName: 'Peeters' }).create();
        const second = await new MemberFactory({ organization, firstName: 'Jonas', lastName: 'Claes' }).create();
        const third = await new MemberFactory({ organization, firstName: 'Marie', lastName: 'Willems' }).create();

        const payout = SettlementReference.create({
            id: 'stl_playwright',
            reference: '1234567.0312.01',
            settledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            amount: 0,
        });

        const online = { method: PaymentMethod.Bancontact, provider: PaymentProvider.Mollie };
        await createPaidRegistration({ organization, member: first, group: kapoenen, price: 40_0000, ...online, settlement: payout });
        await createPaidRegistration({ organization, member: second, group: kapoenen, price: 30_0000, ...online });
        await createPaidRegistration({ organization, member: third, group: kapoenen, price: 20_0000, method: PaymentMethod.PointOfSale });

        const admin = await new UserFactory({
            email: `admin-settlement-${WorkerData.id}-${Date.now()}@test.be`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        await loginAs({ page, user: admin });

        // Boekhouding > Alle betalingen. The export configuration only selects the providers the
        // organization has connected, so the statistics of the table are the way in here.
        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}/boekhouding/betalingen`);

        const table = new TableHelper(page);
        await table.waitForFirstRow();
        await table.toggleSelectAllRows();
        await table.clickAction('Statistieken');

        const breakdownView = page.getByTestId('save-view').last();
        await expect(breakdownView.getByText(/€\s*90\b/).first()).toBeVisible();

        // The payouts: what Mollie already transferred, what it still has to transfer, and the rest.
        // The rows are matched as buttons, because the totals above them repeat the same words.
        await breakdownView.getByRole('button', { name: 'Uitbetalingen', exact: true }).click();

        const payoutRow = breakdownView.getByRole('button', { name: /^1234567\.0312\.01/ });
        await expect(payoutRow).toBeVisible();
        await expect(breakdownView.getByRole('button', { name: /^Nog niet uitbetaald/ })).toBeVisible();
        await expect(breakdownView.getByRole('button', { name: /^Niet online betaald/ })).toBeVisible();

        // Narrowing down to one payout shows exactly what was in it
        await payoutRow.click();

        const narrowedView = page.getByTestId('save-view').last();
        await expect(narrowedView.getByText(/€\s*40\b/).first()).toBeVisible();
        await expect(narrowedView.getByText('Nog niet uitbetaald')).toHaveCount(0);

        // From there the payments of that payout can be listed one by one. The table we came from is
        // still in the navigation stack, so we look at the one on top.
        await narrowedView.getByTestId('show-list-button').click();

        const payoutTable = page.getByTestId('table').last();
        await payoutTable.getByTestId('table-row').first().waitFor();
        await expect(payoutTable.getByTestId('table-row').filter({ hasText: 'Eva' })).toHaveCount(1);
        await expect(payoutTable.getByTestId('table-row').filter({ hasText: 'Jonas' })).toHaveCount(0);
    });

    test('the payouts are left out when nothing was paid online', async ({ page }) => {
        const organization = await createOrganization(`NoSettlements${WorkerData.id}`);

        const kapoenen = await new GroupFactory({ organization, name: new TranslatedString('Kapoenen'), price: 40_0000 }).create();
        const member = await new MemberFactory({ organization, firstName: 'Eva', lastName: 'Peeters' }).create();

        await createPaidRegistration({ organization, member, group: kapoenen, price: 40_0000, method: PaymentMethod.Transfer, iban: 'BE68539007547034' });

        const admin = await new UserFactory({
            email: `admin-no-settlement-${WorkerData.id}-${Date.now()}@test.be`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        await loginAs({ page, user: admin });

        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}/boekhouding/exporteren`);

        const configureView = page.getByTestId('save-view').filter({ hasText: 'Statistieken en totalen berekenen' });
        await expect(configureView).toBeVisible();
        await configureView.getByTestId('save-button').click();

        const breakdownView = page.getByTestId('save-view').last();
        await expect(breakdownView.getByText(/€\s*40\b/).first()).toBeVisible();

        // Nothing has to be paid out, so there is nothing to show per payout
        await expect(breakdownView.getByRole('button', { name: 'Uitbetalingen', exact: true })).toHaveCount(0);
    });

    test('an admin can look at the payments behind the numbers', async ({ page }) => {
        const organization = await createOrganization(`BreakdownList${WorkerData.id}`);

        const kapoenen = await new GroupFactory({ organization, name: new TranslatedString('Kapoenen'), price: 40_0000 }).create();
        const first = await new MemberFactory({ organization, firstName: 'Eva', lastName: 'Peeters' }).create();
        const second = await new MemberFactory({ organization, firstName: 'Jonas', lastName: 'Claes' }).create();

        await createPaidRegistration({ organization, member: first, group: kapoenen, price: 40_0000, priceName: 'Standaardtarief', method: PaymentMethod.Transfer, iban: 'BE68539007547034' });
        await createPaidRegistration({ organization, member: second, group: kapoenen, price: 20_0000, priceName: 'Verminderd tarief', method: PaymentMethod.PointOfSale });

        const admin = await new UserFactory({
            email: `admin-breakdown-list-${WorkerData.id}-${Date.now()}@test.be`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        await loginAs({ page, user: admin });

        const openBreakdown = async () => {
            await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}/boekhouding/exporteren`);
            await page.getByTestId('save-view').filter({ hasText: 'Statistieken en totalen berekenen' }).getByTestId('save-button').click();
            return page.getByTestId('save-view').last();
        };

        // The button in the navigation bar shows everything that was broken down
        const breakdownView = await openBreakdown();
        await expect(breakdownView.getByText(/€\s*60\b/).first()).toBeVisible();
        await breakdownView.getByTestId('show-list-button').click();

        const table = new TableHelper(page);
        await table.waitForFirstRow();
        await expect(table.getRow('Eva')).toHaveCount(1);
        await expect(table.getRow('Jonas')).toHaveCount(1);

        // An article can't be broken down further, so opening it shows the payments it is made of
        const secondBreakdownView = await openBreakdown();
        await secondBreakdownView.getByRole('button', { name: 'Artikels', exact: true }).click();
        await secondBreakdownView.getByRole('heading', { name: 'Inschrijving voor Kapoenen (Verminderd tarief)' }).click();

        await table.waitForFirstRow();
        await expect(table.getRow('Jonas')).toHaveCount(1);
        await expect(table.getRow('Eva')).toHaveCount(0);
    });

    test('an admin sees what was charged, per category and per article', async ({ page }) => {
        const organization = await createOrganization(`BalanceBreakdown${WorkerData.id}`);

        const kapoenen = await new GroupFactory({ organization, name: new TranslatedString('Kapoenen'), price: 40_0000 }).create();
        const welpen = await new GroupFactory({ organization, name: new TranslatedString('Welpen'), price: 25_0000 }).create();

        const first = await new MemberFactory({ organization, firstName: 'Eva', lastName: 'Peeters' }).create();
        const second = await new MemberFactory({ organization, firstName: 'Jonas', lastName: 'Claes' }).create();

        await createPaidRegistration({ organization, member: first, group: kapoenen, price: 40_0000, priceName: 'Standaardtarief', method: PaymentMethod.Transfer, iban: 'BE68539007547034' });
        await createPaidRegistration({ organization, member: second, group: welpen, price: 25_0000, priceName: 'Standaardtarief', method: PaymentMethod.PointOfSale });

        const admin = await new UserFactory({
            email: `admin-balance-breakdown-${WorkerData.id}-${Date.now()}@test.be`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        await loginAs({ page, user: admin });

        // Boekhouding > Aanrekeningen
        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}/boekhouding/balance-items`);

        const table = new TableHelper(page);
        await table.waitForFirstRow();
        await table.toggleSelectAllRows();
        await table.clickAction('Statistieken');

        const breakdownView = page.getByTestId('save-view').last();

        // Everything that was charged, split per group
        await expect(breakdownView.getByText('Aangerekend').first()).toBeVisible();
        await expect(breakdownView.getByText(/€\s*65\b/).first()).toBeVisible();
        await expect(breakdownView.getByRole('heading', { name: 'Kapoenen' })).toBeVisible();
        await expect(breakdownView.getByRole('heading', { name: 'Welpen' })).toBeVisible();

        // Narrowing down to one group leaves only that group, and it can be exported from there
        await breakdownView.getByRole('heading', { name: 'Kapoenen' }).click();

        const narrowedView = page.getByTestId('save-view').last();
        await expect(narrowedView.getByText(/€\s*40\b/).first()).toBeVisible();
        await expect(narrowedView.getByText('Welpen')).toHaveCount(0);

        await narrowedView.getByTestId('save-button').click();
        await expect(page.getByText('Exporteren naar Excel').first()).toBeVisible();
    });

    test('an admin can narrow the statistics down to chosen webshops', async ({ page }) => {
        const organization = await createOrganization(`WebshopFilter${WorkerData.id}`, [STPackageBundle.Members, STPackageBundle.Webshops]);

        // A registration next to the webshop orders, to show "all groups" stays included
        const kapoenen = await new GroupFactory({ organization, name: new TranslatedString('Kapoenen'), price: 40_0000 }).create();
        const member = await new MemberFactory({ organization, firstName: 'Eva', lastName: 'Peeters' }).create();
        await createPaidRegistration({ organization, member, group: kapoenen, price: 40_0000, method: PaymentMethod.PointOfSale, paidAt: dayOfMonth(1) });

        const wafels = await new WebshopFactory({ organizationId: organization.id, name: 'Wafelverkoop' }).create();
        const truien = await new WebshopFactory({ organizationId: organization.id, name: 'Truienverkoop' }).create();
        await createPaidOrder({ organization, webshop: wafels, price: 25_0000, paidAt: dayOfMonth(2) });
        await createPaidOrder({ organization, webshop: truien, price: 10_0000, paidAt: dayOfMonth(3) });

        // More than five webshops, so the list gets a search bar
        for (const name of ['Koekjesverkoop', 'Kaarsenverkoop', 'Bloemenverkoop', 'Pannenkoekenverkoop']) {
            await new WebshopFactory({ organizationId: organization.id, name }).create();
        }

        const admin = await new UserFactory({
            email: `admin-webshop-filter-${WorkerData.id}-${Date.now()}@test.be`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        await loginAs({ page, user: admin });

        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}/boekhouding/exporteren`);

        const configureView = page.getByTestId('save-view').filter({ hasText: 'Statistieken en totalen berekenen' });
        await expect(configureView).toBeVisible();

        // Unchecking "all webshops" shows the webshops with a search bar
        await configureView.getByText('Alle webshops').click();

        const search = configureView.getByPlaceholder('Zoeken');
        await expect(search).toBeVisible();
        await expect(configureView.getByText('Truienverkoop')).toBeVisible();

        await search.fill('Wafel');
        await expect(configureView.getByText('Truienverkoop')).toHaveCount(0);
        await configureView.getByText('Wafelverkoop').click();

        await configureView.getByTestId('save-button').click();

        // Only the Wafelverkoop order and the registration are counted: 25 + 40
        const breakdownView = page.getByTestId('save-view').last();
        await expect(breakdownView.getByText(/€\s*65\b/).first()).toBeVisible();
    });

    test('an admin can narrow the statistics down to chosen registration groups', async ({ page }) => {
        const organization = await createOrganization(`GroupFilter${WorkerData.id}`);

        const kapoenen = await new GroupFactory({ organization, name: new TranslatedString('Kapoenen'), price: 40_0000 }).create();
        const welpen = await new GroupFactory({ organization, name: new TranslatedString('Welpen'), price: 25_0000 }).create();

        // The groups have to be in a category of the period to be listed in the filter
        const period = (await RegistrationPeriod.getByID(organization.periodId))!;
        const organizationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period }).create();
        const takken = GroupCategory.create({
            settings: GroupCategorySettings.create({ name: 'Takken' }),
            groupIds: [kapoenen.id, welpen.id],
        });
        organizationPeriod.settings.categories.push(takken);
        organizationPeriod.settings.rootCategory?.categoryIds.push(takken.id);
        await organizationPeriod.save();

        const first = await new MemberFactory({ organization, firstName: 'Eva', lastName: 'Peeters' }).create();
        const second = await new MemberFactory({ organization, firstName: 'Jonas', lastName: 'Claes' }).create();
        await createPaidRegistration({ organization, member: first, group: kapoenen, price: 40_0000, method: PaymentMethod.PointOfSale, paidAt: dayOfMonth(1) });
        await createPaidRegistration({ organization, member: second, group: welpen, price: 25_0000, method: PaymentMethod.PointOfSale, paidAt: dayOfMonth(2) });

        const admin = await new UserFactory({
            email: `admin-group-filter-${WorkerData.id}-${Date.now()}@test.be`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        await loginAs({ page, user: admin });

        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}/boekhouding/exporteren`);

        const configureView = page.getByTestId('save-view').filter({ hasText: 'Statistieken en totalen berekenen' });
        await expect(configureView).toBeVisible();

        // The organization has no webshops, so there is no webshop filter
        await expect(configureView.getByText('Alle webshops')).toHaveCount(0);

        // Only two groups: no search bar
        await configureView.getByText('Alle inschrijvingsgroepen').click();
        await expect(configureView.getByText('Welpen')).toBeVisible();
        await expect(configureView.getByPlaceholder('Zoeken')).toHaveCount(0);

        await configureView.getByText('Kapoenen').click();
        await configureView.getByTestId('save-button').click();

        // Only the Kapoenen registration is counted
        const breakdownView = page.getByTestId('save-view').last();
        await expect(breakdownView.getByText(/€\s*40\b/).first()).toBeVisible();
        await expect(breakdownView.getByText('Welpen')).toHaveCount(0);
    });
});
