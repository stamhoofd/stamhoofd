// test should always be imported first
import { test, setup } from '../test-fixtures/organization.js';
setup();

// other imports
import { MollieMocker } from '@stamhoofd/backend/tests/helpers';
import type { Organization } from '@stamhoofd/models';
import { STPackageType } from '@stamhoofd/structures';
import type { Page } from '@playwright/test';
import { TestUtils } from '@stamhoofd/test-utils';
import { PackageScenario } from '../flows/PackageScenario.js';
import type { Pages } from '../helpers/index.js';
import { TestBilling, WorkerData } from '../helpers/index.js';

/**
 * SAAS package activation / billing flow (organization userMode).
 *
 * userMode MUST be 'organization' here: PaymentService.deactivatePackagesIfNeeded only marks
 * packages as "failed payment" (used by the chargeback flow) when STAMHOOFD.userMode === 'organization'.
 *
 * Payments go through the membership (selling) organization via Mollie, which is faked by the
 * MollieMocker (HTTP interception of api.mollie.com, mirroring the StripeMocker).
 */
test.describe.fixme('Packages', () => {
    let mollieMocker: MollieMocker;
    let payingOrganization: Organization;

    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test.beforeEach(async () => {
        mollieMocker = new MollieMocker();
        mollieMocker.start();

        // Configure the membership organization for Mollie + give our user finance permissions and a billing company.
        await TestBilling.setupMembershipOrganization(mollieMocker);
        payingOrganization = await TestBilling.getPayingOrganization(WorkerData.user);
        await TestBilling.preparePayingOrganization(WorkerData.user, payingOrganization);
    });

    test.afterEach(async () => {
        mollieMocker.stop();
        // Clear billing state only - keep the worker organization/user (its auth token is reused).
        await WorkerData.databaseHelper.clearBilling();
    });

    function scenario(page: Page, pages: Pages) {
        return new PackageScenario({ page, pages, organization: payingOrganization, mollieMocker });
    }

    test('a new organization can start the trial for both webshops and members', async ({ page, pages }) => {
        const s = scenario(page, pages);
        await s.gotoPackages();

        await test.step('both packages offer a free trial', async () => {
            await s.assertStartTrialButtonVisible('Members');
            await s.assertStartTrialButtonVisible('Webshops');
        });

        await test.step('starting the members trial activates it without a card', async () => {
            await s.startTrial('Members');
        });

        await test.step('starting the webshops trial activates it without a card', async () => {
            await s.startTrial('Webshops');
        });
    });

    test('activating the webshops package requires linking a payment card', async ({ page, pages }) => {
        const s = scenario(page, pages);
        await s.gotoPackages();

        await s.openCheckout('Webshops');
        await test.step('the checkout requires a card (mandate)', async () => {
            // Advance to the payment step and assert a card/mandate is required.
            await s.advanceToPaymentStep();
            await s.assertCardRequired();
        });
    });

    test('activating the members package requires linking a payment card', async ({ page, pages }) => {
        const s = scenario(page, pages);
        await s.gotoPackages();

        await s.openCheckout('Members');
        await test.step('the checkout requires a card (mandate)', async () => {
            await s.advanceToPaymentStep();
            await s.assertCardRequired();
        });
    });

    test('activating a package links a new card and completes via Mollie', async ({ page, pages }) => {
        const s = scenario(page, pages);
        await s.gotoPackages();

        await s.activateWithNewCard('Webshops');

        await test.step('the package is now active', async () => {
            await s.gotoPackages();
            await s.assertPackageActive('Webshops');
        });
    });

    test('activating a package can reuse an existing saved card', async ({ page, pages }) => {
        const s = scenario(page, pages);

        // First activation creates a saved card (mandate).
        await s.gotoPackages();
        await s.activateWithNewCard('Webshops');

        // Second activation (members) should be able to reuse the saved default card.
        await s.gotoPackages();
        await s.activateWithExistingCard('Members');

        await test.step('the members package is now active', async () => {
            await s.gotoPackages();
            await s.assertPackageActive('Members');
        });
    });

    /**
     * Renewal of the members package charges for the *current* number of active members.
     * Seed a members package previously paid for 120 members, reduce active members to 100, put
     * the package near expiry, then renew and assert the new charge is for 100 members.
     *
     * FIXME: requires seeding active registrations + asserting the created BalanceItem quantity;
     * needs live tuning of the multi-step renewal UI.
     */
    test.fixme('renewing the members package charges for the current member count', async ({ page, pages }) => {
        const s = scenario(page, pages);

        const nearExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 20); // < 2 months -> expiresSoon
        await TestBilling.createActivePackage(payingOrganization, {
            type: STPackageType.Members,
            validUntil: nearExpiry,
        });

        // TODO: seed 100 active members (registrations) for payingOrganization in the current period.

        await s.gotoPackages();
        await s.assertRenewButtonVisible('Members');
        await s.activateWithExistingCard('Members');

        // TODO: assert the renewal BalanceItem has quantity === 100.
    });

    /**
     * Renewing the webshops package normally requires no payment, only confirming the default card.
     *
     * FIXME: webshops in the current model never expire (validUntil null); this needs a seeded
     * webshops package with a validUntil to surface the renew button, then confirming the default card.
     */
    test.fixme('renewing the webshops package only confirms the default card (no payment)', async ({ page, pages }) => {
        const s = scenario(page, pages);

        const nearExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 20);
        await TestBilling.createActivePackage(payingOrganization, {
            type: STPackageType.Webshops,
            validUntil: nearExpiry,
        });

        await s.gotoPackages();
        await s.assertRenewButtonVisible('Webshops');
        await s.activateWithExistingCard('Webshops');
    });

    /**
     * During renewal the user can link a new card and it becomes the new default.
     *
     * FIXME: needs assertion that org.serverMeta.mollieMandateId points at the new mandate.
     */
    test.fixme('linking a new card during renewal sets it as the new default', async ({ page, pages }) => {
        const s = scenario(page, pages);

        const nearExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 20);
        await TestBilling.createActivePackage(payingOrganization, {
            type: STPackageType.Members,
            validUntil: nearExpiry,
        });

        await s.gotoPackages();
        await s.activateWithNewCard('Members');

        // TODO: assert the new mandate is now the default.
    });

    /**
     * Chargeback flow: when a chargeback happens (mollie-chargebacks cron), all packages are marked
     * "failed payment" and the UI shows an error to pay the outstanding balance within X days.
     * Paying the outstanding balance clears the error.
     *
     * FIXME: drive via mollieMocker.createChargeback(payment) + doCheckMollieChargebacks(true),
     * then pay the outstanding balance through the checkout.
     */
    test.fixme('a chargeback marks packages failed and the user can pay the outstanding balance', async ({ page, pages }) => {
        const s = scenario(page, pages);

        await s.gotoPackages();
        await s.activateWithNewCard('Members');

        // TODO:
        // - const payment = mollieMocker.getLastPayment();
        // - mollieMocker.createChargeback(payment);
        // - await doCheckMollieChargebacks(true); // from backend crons/mollie-chargebacks
        // - await s.gotoPackages(); await s.assertPaymentFailedWarningVisible();
        // - pay outstanding balance via checkout
        // - await s.assertNoPaymentFailedWarning();
    });

    /**
     * If the members package has expired (but is still within its grace period), the user cannot
     * start the trial again - they must renew the package instead.
     */
    test('an expired members package blocks the trial and requires renewal', async ({ page, pages }) => {
        const s = scenario(page, pages);

        const expired = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2);
        await TestBilling.createActivePackage(payingOrganization, {
            type: STPackageType.Members,
            validUntil: expired,
            removeAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 20),
        });

        await s.gotoPackages();
        // The free trial is no longer offered; the user must (re)activate the paid package.
        await s.assertStartTrialButtonNotVisible('Members');
        await s.assertReactivateButtonVisible('Members');
    });

    test('a package without removeAt blocks the trial and requires renewal', async ({ page, pages }) => {
        const s = scenario(page, pages);

        const expired = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2);
        await TestBilling.createActivePackage(payingOrganization, {
            type: STPackageType.Members,
            validUntil: expired,
            removeAt: null,
        });

        await s.gotoPackages();
        // The free trial is no longer offered; the user must (re)activate the paid package.
        await s.assertStartTrialButtonNotVisible('Members');
        await s.assertReactivateButtonVisible('Members');
    });

    test('when an expired package moves past removeAt, normal purchase becomes available again', async ({ page, pages }) => {
        const s = scenario(page, pages);

        const expired = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2);
        await TestBilling.createActivePackage(payingOrganization, {
            type: STPackageType.Members,
            validUntil: expired,
            removeAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20),
        });

        await s.gotoPackages();
        await s.assertStartTrialButtonVisible('Members');
    });
});
