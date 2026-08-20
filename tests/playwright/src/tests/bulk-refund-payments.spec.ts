// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { MollieMockPayment } from '@stamhoofd/backend/tests/helpers';
import { MollieMocker, STPackageService } from '@stamhoofd/backend/tests/helpers';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import type { Organization, User } from '@stamhoofd/models';
import { BalanceItemFactory, BalanceItemPayment, MolliePayment, OrganizationFactory, Payment, Token, UserFactory } from '@stamhoofd/models';
import {
    appToUri,
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
} from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { TableHelper, WorkerData } from '../helpers/index.js';

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

test.describe('Bulk refund payments @bulk-refund-payments', () => {
    let mollieMocker: MollieMocker | undefined;

    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test.afterEach(() => {
        mollieMocker?.stop();
        mollieMocker = undefined;
    });

    async function createOrganization(name: string, { hasBulkRefund = true, hasMollie = true }: { hasBulkRefund?: boolean; hasMollie?: boolean } = {}): Promise<Organization> {
        const organization = await new OrganizationFactory({
            name,
            packages: [STPackageBundle.Members],
        }).create();

        // The bulk refund is hidden behind a feature flag by default
        organization.privateMeta.featureFlags = hasBulkRefund ? ['bulk-refund-payments'] : [];

        // A connected Mollie account: mollieOnboarding stays null without one
        organization.privateMeta.mollieOnboarding = hasMollie
            ? MollieOnboarding.create({
                    canReceivePayments: true,
                    canReceiveSettlements: true,
                    status: MollieStatus.Completed,
                })
            : null;
        await organization.save();

        await STPackageService.updateOrganizationPackages(organization.id);

        return organization;
    }

    /**
     * A payment of one article, succeeded unless another status is given. Mollie payments also get
     * the link to the (paid) payment at Mollie that a refund needs.
     */
    async function createPaidPayment({ organization, description, price, method, provider, status = PaymentStatus.Succeeded }: {
        organization: Organization;
        description: string;
        price: number;
        method: PaymentMethod;
        provider?: PaymentProvider;
        status?: PaymentStatus;
    }) {
        const succeeded = status === PaymentStatus.Succeeded;

        const balanceItem = await new BalanceItemFactory({
            organizationId: organization.id,
            description,
            amount: 1,
            unitPrice: price,
            pricePaid: succeeded ? price : 0,
            pricePending: succeeded ? 0 : price,
        }).create();

        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = method;
        payment.provider = provider ?? null;
        payment.status = status;
        payment.type = PaymentType.Payment;
        payment.price = price;
        payment.paidAt = succeeded ? new Date() : null;
        await payment.save();

        const balanceItemPayment = new BalanceItemPayment();
        balanceItemPayment.balanceItemId = balanceItem.id;
        balanceItemPayment.paymentId = payment.id;
        balanceItemPayment.organizationId = organization.id;
        balanceItemPayment.price = price;
        await balanceItemPayment.save();

        if (provider === PaymentProvider.Mollie) {
            const mockPayment: MollieMockPayment = {
                id: mollieMocker!.createId('tr'),
                status: 'paid',
                amount: { currency: 'EUR', value: (Math.round(price / 100) / 100).toFixed(2) },
                internalPaymentId: payment.id,
                redirectUrl: null,
                sequenceType: 'oneoff',
                customerId: null,
                mandateId: null,
                isCancelable: false,
                details: null,
            };
            mollieMocker!.payments.push(mockPayment);

            const link = new MolliePayment();
            link.paymentId = payment.id;
            link.mollieId = mockPayment.id;
            await link.save();
        }

        return payment;
    }

    async function createAdmin(organization: Organization) {
        return await new UserFactory({
            email: `admin-bulk-refund-${WorkerData.id}-${Date.now()}@test.be`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
    }

    function openPayments(page: Page, organization: Organization) {
        return page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}/boekhouding/betalingen`);
    }

    /**
     * The table of transfers that still have to be checked off, which only ever lists transfers.
     */
    function openTransfers(page: Page, organization: Organization) {
        return page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}/boekhouding/overschrijvingen`);
    }

    async function expectNoRefundAction(page: Page) {
        const table = new TableHelper(page);
        await table.waitForFirstRow();
        await table.toggleSelectAllRows();

        await page.getByTestId('more-button').click();

        // The menu is open (it lists the other actions), but the refund is not part of it
        await expect(page.getByTestId('context-menu-item-title').filter({ hasText: 'Exporteer naar Excel' })).toBeVisible();
        await expect(page.getByTestId('context-menu-item-title').filter({ hasText: 'Online terugbetalen' })).toHaveCount(0);
    }

    test('an admin refunds the Mollie payments of a selection at once, after confirming the number', async ({ page }) => {
        const organization = await createOrganization(`BulkRefund${WorkerData.id}`);

        mollieMocker = new MollieMocker();
        mollieMocker.start();
        await mollieMocker.setupToken(organization);

        const first = await createPaidPayment({ organization, description: 'Kamp Eva', price: 40_0000, method: PaymentMethod.Bancontact, provider: PaymentProvider.Mollie });
        const second = await createPaidPayment({ organization, description: 'Kamp Jonas', price: 25_0000, method: PaymentMethod.iDEAL, provider: PaymentProvider.Mollie });
        const transfer = await createPaidPayment({ organization, description: 'Kamp Marie', price: 30_0000, method: PaymentMethod.Transfer });

        await loginAs({ page, user: await createAdmin(organization) });
        await openPayments(page, organization);

        const table = new TableHelper(page);
        await table.waitForFirstRow();
        await table.toggleSelectAllRows();
        await table.clickAction('Online terugbetalen');

        // The overview splits the selection: the transfer cannot be refunded via Mollie
        const refundView = page.getByTestId('refund-payments-view');
        await expect(refundView.getByTestId('refundable-count')).toContainText('2 betalingen');
        await expect(refundView.getByTestId('not-via-mollie-count')).toContainText('één betaling');
        await expect(refundView.getByText(/€\s*65\b/).first()).toBeVisible();

        // The refund only starts once the number of payments is typed over
        const saveButton = refundView.getByTestId('save-button');
        await expect(saveButton).toBeDisabled();

        const confirmation = refundView.getByTestId('refund-confirmation-input');
        await confirmation.fill('3');
        await expect(saveButton).toBeDisabled();

        await confirmation.fill('2');
        await expect(saveButton).toBeEnabled();
        await saveButton.click();

        await refundView.waitFor({ state: 'detached' });

        // Both Mollie payments were refunded for their full amount, the transfer was skipped
        await expect.poll(() => mollieMocker?.refunds.length).toBe(2);
        expect(mollieMocker!.refunds.map(r => r.amount.value).sort()).toEqual(['25.00', '40.00']);

        for (const payment of [first, second]) {
            const refunds = await Payment.select().where('reversingPaymentId', payment.id).fetch();
            expect(refunds).toHaveLength(1);
            expect(refunds[0]).toMatchObject({
                type: PaymentType.Refund,
                status: PaymentStatus.Pending,
                provider: PaymentProvider.Mollie,
                price: -payment.price,
            });
        }

        expect(await Payment.select().where('reversingPaymentId', transfer.id).fetch()).toHaveLength(0);
    });

    test('a payment that was already refunded is left out of a next bulk refund', async ({ page }) => {
        const organization = await createOrganization(`BulkRefundPartial${WorkerData.id}`);

        mollieMocker = new MollieMocker();
        mollieMocker.start();
        await mollieMocker.setupToken(organization);

        const refunded = await createPaidPayment({ organization, description: 'Kamp Eva', price: 40_0000, method: PaymentMethod.Bancontact, provider: PaymentProvider.Mollie });
        await createPaidPayment({ organization, description: 'Kamp Jonas', price: 25_0000, method: PaymentMethod.Bancontact, provider: PaymentProvider.Mollie });

        // The first payment was already refunded earlier
        refunded.refundedAmount = -40_0000;
        await refunded.save();

        await loginAs({ page, user: await createAdmin(organization) });
        await openPayments(page, organization);

        const table = new TableHelper(page);
        await table.waitForFirstRow();
        await table.toggleSelectAllRows();
        await table.clickAction('Online terugbetalen');

        const refundView = page.getByTestId('refund-payments-view');
        await expect(refundView.getByTestId('refundable-count')).toContainText('één betaling');
        await expect(refundView.getByTestId('not-refundable-count')).toContainText('één betaling');

        await refundView.getByTestId('refund-confirmation-input').fill('1');
        await refundView.getByTestId('save-button').click();
        await refundView.waitFor({ state: 'detached' });

        // Only the payment that still had its full amount was refunded
        await expect.poll(() => mollieMocker?.refunds.length).toBe(1);
        expect(mollieMocker!.refunds[0].amount.value).toBe('25.00');
        expect(await Payment.select().where('reversingPaymentId', refunded.id).fetch()).toHaveLength(0);
    });

    test('without the feature flag the action is not offered', async ({ page }) => {
        const organization = await createOrganization(`NoBulkRefund${WorkerData.id}`, { hasBulkRefund: false });

        mollieMocker = new MollieMocker();
        mollieMocker.start();
        await mollieMocker.setupToken(organization);

        await createPaidPayment({ organization, description: 'Kamp Eva', price: 40_0000, method: PaymentMethod.Bancontact, provider: PaymentProvider.Mollie });

        await loginAs({ page, user: await createAdmin(organization) });
        await openPayments(page, organization);

        await expectNoRefundAction(page);
    });

    test('without a Mollie account the action is not offered', async ({ page }) => {
        const organization = await createOrganization(`NoMollieAccount${WorkerData.id}`, { hasMollie: false });

        // Payments of a Mollie account that was disconnected since: there is no account left to
        // refund them through
        mollieMocker = new MollieMocker();
        mollieMocker.start();

        await createPaidPayment({ organization, description: 'Kamp Eva', price: 40_0000, method: PaymentMethod.Bancontact, provider: PaymentProvider.Mollie });

        await loginAs({ page, user: await createAdmin(organization) });
        await openPayments(page, organization);

        await expectNoRefundAction(page);
    });

    test('the transfers to check never offer the action', async ({ page }) => {
        const organization = await createOrganization(`TransfersOnly${WorkerData.id}`);

        mollieMocker = new MollieMocker();
        mollieMocker.start();
        await mollieMocker.setupToken(organization);

        // A transfer that still has to be checked off, and a Mollie payment that this table
        // never lists
        await createPaidPayment({ organization, description: 'Kamp Sam', price: 30_0000, method: PaymentMethod.Transfer, status: PaymentStatus.Created });
        await createPaidPayment({ organization, description: 'Kamp Eva', price: 40_0000, method: PaymentMethod.Bancontact, provider: PaymentProvider.Mollie });

        await loginAs({ page, user: await createAdmin(organization) });
        await openTransfers(page, organization);

        await expectNoRefundAction(page);

        // The action is offered on the table that does list Mollie payments, so the difference
        // really comes from the payment methods of this table
        await openPayments(page, organization);
        const table = new TableHelper(page);
        await table.waitForFirstRow();
        await table.toggleSelectAllRows();
        await page.getByTestId('more-button').click();
        await expect(page.getByTestId('context-menu-item-title').filter({ hasText: 'Online terugbetalen' })).toBeVisible();
    });
});
