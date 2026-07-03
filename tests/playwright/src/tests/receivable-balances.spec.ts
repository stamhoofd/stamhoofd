// test should always be imported first
import { setup, test } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { MollieMocker, STPackageService } from '@stamhoofd/backend/tests/helpers';
import type { Group, User } from '@stamhoofd/models';
import { BalanceItem, BalanceItemFactory, BalanceItemPayment, CachedBalance, GroupFactory, MemberFactory, MolliePayment, OrganizationFactory, Payment, RegistrationFactory, Token, UserFactory } from '@stamhoofd/models';
import {
    appToUri,
    BalanceItemRelation,
    BalanceItemRelationType,
    BalanceItemStatus,
    BalanceItemType,
    PaymentMethod,
    PaymentProvider,
    PaymentStatus,
    PaymentType,
    PermissionLevel,
    Permissions,
    ReceivableBalanceType,
    STPackageBundle,
    Token as TokenStruct,
    TranslatedString,
    Version,
} from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { TableHelper, WorkerData } from '../helpers/index.js';

/**
 * Write the correct auth token into localStorage (mirrors webshop-orders.spec).
 */
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

test.describe('Receivable balances (organization mode) @receivable-balances', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    let mollieMocker: MollieMocker;

    test.beforeEach(() => {
        mollieMocker = new MollieMocker();
        mollieMocker.start();
    });

    test.afterEach(() => {
        mollieMocker.stop();
    });

    test('a negative member balance can be refunded via an earlier Mollie payment', async ({ page }) => {
        // A member paid 50 euro via Mollie for a registration. That registration was canceled
        // and replaced by a registration of 30 euro, so the member has an open balance of -20.
        const organization = await new OrganizationFactory({
            name: `RefundBalance${WorkerData.id}`,
            packages: [STPackageBundle.Members],
        }).create();
        await STPackageService.updateOrganizationPackages(organization.id);
        await mollieMocker.setupToken(organization);

        const member = await new MemberFactory({ organization, firstName: 'Refunda', lastName: 'Tester' }).create();
        const canceledGroup = await new GroupFactory({ organization, price: 50_0000 }).create();
        const newGroup = await new GroupFactory({ organization, price: 30_0000 }).create();

        const canceledRegistration = await new RegistrationFactory({ member, group: canceledGroup, deactivatedAt: new Date() }).create();
        const newRegistration = await new RegistrationFactory({ member, group: newGroup }).create();

        const registrationRelations = (group: Group) => new Map([
            [BalanceItemRelationType.Member, BalanceItemRelation.create({ id: member.id, name: new TranslatedString('Refunda Tester') })],
            [BalanceItemRelationType.Group, BalanceItemRelation.create({ id: group.id, name: group.settings.name })],
        ]);

        // The canceled registration: 50 euro paid, nothing due anymore -> open amount -50
        const canceledItem = await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: member.id,
            registrationId: canceledRegistration.id,
            type: BalanceItemType.Registration,
            status: BalanceItemStatus.Canceled,
            amount: 1,
            unitPrice: 50_0000,
            pricePaid: 50_0000,
            relations: registrationRelations(canceledGroup),
        }).create();

        // The replacement registration: 30 euro due -> open amount +30
        const newItem = await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: member.id,
            registrationId: newRegistration.id,
            type: BalanceItemType.Registration,
            status: BalanceItemStatus.Due,
            amount: 1,
            unitPrice: 30_0000,
            relations: registrationRelations(newGroup),
        }).create();

        // The original Mollie payment of 50 euro for the canceled registration
        const sourcePayment = new Payment();
        sourcePayment.organizationId = organization.id;
        sourcePayment.method = PaymentMethod.Bancontact;
        sourcePayment.provider = PaymentProvider.Mollie;
        sourcePayment.status = PaymentStatus.Succeeded;
        sourcePayment.type = PaymentType.Payment;
        sourcePayment.price = 50_0000;
        sourcePayment.paidAt = new Date();
        await sourcePayment.save();

        const sourceBalanceItemPayment = new BalanceItemPayment();
        sourceBalanceItemPayment.balanceItemId = canceledItem.id;
        sourceBalanceItemPayment.paymentId = sourcePayment.id;
        sourceBalanceItemPayment.organizationId = organization.id;
        sourceBalanceItemPayment.price = 50_0000;
        await sourceBalanceItemPayment.save();

        // Register the payment at 'Mollie'
        const mockPayment = {
            id: mollieMocker.createId('tr'),
            status: 'paid' as const,
            amount: { currency: 'EUR', value: '50.00' },
            internalPaymentId: sourcePayment.id,
            redirectUrl: null,
            sequenceType: 'oneoff' as const,
            customerId: null,
            mandateId: null,
            isCancelable: false,
            details: null,
        };
        mollieMocker.payments.push(mockPayment);

        const molliePayment = new MolliePayment();
        molliePayment.paymentId = sourcePayment.id;
        molliePayment.mollieId = mockPayment.id;
        await molliePayment.save();

        // Make sure the member shows up in the receivable balances table
        await CachedBalance.updateForObjects(organization.id, [member.id], ReceivableBalanceType.member);
        const cachedBefore = await CachedBalance.getForObjects([member.id], organization.id, ReceivableBalanceType.member);
        expect(cachedBefore[0].amountOpen).toBe(-20_0000);

        // Log in as an admin and open the receivable balances table
        const admin = await new UserFactory({
            email: `admin-balances-${WorkerData.id}-${Date.now()}@test.be`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        await loginAs({ page, user: admin });

        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${organization.uri}/boekhouding/openstaande-bedragen`);

        const table = new TableHelper(page);
        await table.waitForFirstRow();
        await table.getRow('Refunda Tester').click();

        // The member has an open balance of -20 euro
        await expect(page.getByText('Terug te betalen').first()).toBeVisible();
        await expect(page.getByText(/-\s*€\s*20\b/).first()).toBeVisible();

        // Register a refund: the items are preselected (-50 and +30) and the
        // online refund via the earlier Mollie payment is the default method
        await page.getByText('Terugbetaling registreren').click();

        const refundView = page.getByTestId('edit-payment-view');
        await expect(refundView.getByText('Online terugbetaling (automatisch)').first()).toBeVisible();
        await expect(refundView.getByText(/-\s*€\s*20\b/).first()).toBeVisible();

        await refundView.getByTestId('save-button').click();
        await page.getByRole('button', { name: 'Ja, terugbetalen' }).click();
        await refundView.waitFor({ state: 'detached' });

        // ---- Database checks: the refund is pending until Mollie executes it ----

        // A refund payment of -20 was created, linked to the source payment
        const refunds = await Payment.select().where('reversingPaymentId', sourcePayment.id).fetch();
        expect(refunds).toHaveLength(1);
        const refund = refunds[0];
        expect(refund).toMatchObject({
            type: PaymentType.Refund,
            price: -20_0000,
            status: PaymentStatus.Pending,
            method: PaymentMethod.Bancontact,
            provider: PaymentProvider.Mollie,
        });

        // The refund reverses the canceled registration (-50) and pays the new one (+30)
        const refundItems = await BalanceItemPayment.select().where('paymentId', refund.id).fetch();
        expect(refundItems).toHaveLength(2);
        expect(refundItems.find(i => i.balanceItemId === canceledItem.id)!.price).toBe(-50_0000);
        expect(refundItems.find(i => i.balanceItemId === newItem.id)!.price).toBe(30_0000);

        // Mollie received a refund of 20 euro on the original payment of 50 euro
        expect(mollieMocker.refunds).toHaveLength(1);
        expect(mollieMocker.refunds[0].amount.value).toBe('20.00');
        expect(mollieMocker.refunds[0].paymentId).toBe(mockPayment.id);

        // The Mollie refund is linked to the refund payment (so the cron won't register it twice)
        const link = await MolliePayment.select().where('mollieId', mollieMocker.refunds[0].id).first(false);
        expect(link).not.toBeNull();
        expect(link!.paymentId).toBe(refund.id);

        // The source payment tracks the pending refund amount, nothing is refunded yet
        let updatedSource = await Payment.getByID(sourcePayment.id);
        expect(updatedSource!.refundedAmount).toBe(0);
        expect(updatedSource!.pendingRefundAmount).toBe(-20_0000);

        // ---- UI checks while pending (the balance view reloads automatically) ----

        // The pending refund of -20 is shown under the pending payments
        await expect(page.getByRole('heading', { name: 'In verwerking' })).toBeVisible();
        const pendingRefundRow = page.getByRole('button', { name: /terugbetaling Via Bancontact/ });
        await expect(pendingRefundRow).toBeVisible();
        await expect(pendingRefundRow.getByText(/-\s*€\s*20\b/)).toBeVisible();

        // Nothing is outstanding anymore and a second refund is not possible
        await expect(page.getByText('Geen openstaand bedrag')).toBeVisible();
        await expect(page.getByText('Terugbetaling registreren')).toHaveCount(0);

        // ---- Mollie executes the refund and calls the webhook ----

        await mollieMocker.settleRefund();

        const updatedRefund = await Payment.getByID(refund.id);
        expect(updatedRefund!.status).toBe(PaymentStatus.Succeeded);

        // The source payment tracks the refunded amount
        updatedSource = await Payment.getByID(sourcePayment.id);
        expect(updatedSource!.refundedAmount).toBe(-20_0000);
        expect(updatedSource!.pendingRefundAmount).toBe(0);

        // The canceled registration is no longer paid, the new one is now paid
        const updatedCanceledItem = await BalanceItem.getByID(canceledItem.id);
        expect(updatedCanceledItem!.pricePaid).toBe(0);
        const updatedNewItem = await BalanceItem.getByID(newItem.id);
        expect(updatedNewItem!.pricePaid).toBe(30_0000);

        // The cached outstanding balance of the member is zero again
        await expect.poll(async () => {
            const balances = await CachedBalance.getForObjects([member.id], organization.id, ReceivableBalanceType.member);
            return balances[0]?.amountOpen ?? null;
        }).toBe(0);

        // ---- UI checks after the refund succeeded ----

        await page.reload();

        // The refund payment of -20 is shown in the payments list, no longer as pending
        await expect(page.getByRole('heading', { name: 'Betalingen' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'In verwerking' })).toHaveCount(0);

        const refundRow = page.getByRole('button', { name: /terugbetaling Via Bancontact/ });
        await expect(refundRow).toBeVisible();
        await expect(refundRow.getByText(/-\s*€\s*20\b/)).toBeVisible();

        // No outstanding amount anymore: all items are settled and the refund option is gone
        await expect(page.getByText('Geen openstaand bedrag')).toBeVisible();
        await expect(page.getByText('Terugbetaling registreren')).toHaveCount(0);
    });
});
