import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { MollieMocker } from '@stamhoofd/backend/tests/helpers';
import type { Organization } from '@stamhoofd/models';
import { STPackageBundle } from '@stamhoofd/structures';
import type { Pages } from '../helpers/index.js';
import { WorkerData } from '../helpers/index.js';

/**
 * UI labels resolved from the Dutch translation namespace used by the dashboard build.
 * Keep these in one place so a copy change only needs one update here.
 */
const Labels = {
    settingsTab: 'Instellingen',
    packagesTitle: 'Functionaliteiten activeren',
    startTrialButton: 'Uitproberen',
    renewButton: 'Verlengen',
    activateButton: 'Activeren',
    reactivateButton: 'Heractiveren',
    trialActive: 'In proefperiode',
    active: 'Bekijk',
    expiresSoon: 'Vervalt binnenkort',
    newCard: 'Nieuwe kaart',
    creditCardMethod: 'kredietkaart',
    confirmButtonText: ['Betalen', 'Bevestigen'],
    // BillingWarningBox failed-payment message (substring match)
    paymentFailed: /betaling.*mislukt/i,
};

export type PackageName = 'Members' | 'Webshops';

const bundleForName: Record<PackageName, STPackageBundle> = {
    Members: STPackageBundle.Members,
    Webshops: STPackageBundle.Webshops,
};

/**
 * Reusable flow + assertion helpers for the SAAS package activation / billing flow.
 *
 * The scenario drives the real dashboard UI. Payments are completed by a MollieMocker:
 * the checkout redirects to a mocked Mollie checkout page, the mocker marks the payment
 * paid (creating a mandate where needed) and the test navigates back to the captured
 * redirect URL where the dashboard polls the payment status and shows the success view.
 */
export class PackageScenario {
    readonly page: Page;
    readonly pages: Pages;
    readonly organization: Organization;
    readonly mollieMocker: MollieMocker;

    constructor(options: { page: Page; pages: Pages; organization: Organization; mollieMocker: MollieMocker }) {
        this.page = options.page;
        this.pages = options.pages;
        this.organization = options.organization;
        this.mollieMocker = options.mollieMocker;
    }

    // ---- Navigation -------------------------------------------------------

    private get dashboardUrl() {
        return `${WorkerData.urls.dashboard}/dashboard/${this.organization.uri}`;
    }

    async gotoPackages() {
        await this.page.goto(this.dashboardUrl);
        await expect(this.page.getByTestId('app-name')).toBeVisible();

        // The settings tab lives under the "Meer" (More) menu in the tab bar.
        const settingsTab = this.page.getByRole('button', { name: Labels.settingsTab, exact: false });
        if (!(await settingsTab.first().isVisible().catch(() => false))) {
            await this.page.getByRole('button', { name: 'Meer', exact: false }).first().click();
        }
        await settingsTab.first().click();

        // Open the "Functionaliteiten activeren" item.
        await this.page.getByTestId('open-packages-button').click();

        // Wait for the package list to render.
        await expect(this.packageRow('Members')).toBeVisible();
    }

    packageRow(name: PackageName): Locator {
        return this.page.getByTestId('package-' + bundleForName[name]);
    }

    // ---- Flows ------------------------------------------------------------

    /**
     * Start the free trial for a package (no card required). Returns once the row reflects the trial.
     */
    async startTrial(name: PackageName) {
        await this.assertStartTrialButtonVisible(name);
        await this.packageRow(name).click();
        await this.assertTrialActive(name);
    }

    /**
     * Open the paid checkout flow for a package (the multi-step popup).
     *
     * When a free trial is still on offer, clicking the row starts the trial instead of opening
     * the paid checkout. In that case we start the trial first so the next click opens the paid
     * (activation) checkout - this mirrors the real product flow (you activate from within a trial).
     */
    async openCheckout(name: PackageName) {
        if (await this.packageRow(name).getByText(Labels.startTrialButton).isVisible().catch(() => false)) {
            await this.startTrial(name);
        }
        await this.packageRow(name).click();
    }

    /**
     * Activate (or renew) a package paying with a new card. Walks through the checkout steps,
     * selects a new credit-card mandate, confirms and completes the Mollie payment.
     */
    async activateWithNewCard(name: PackageName) {
        await this.openCheckout(name);
        await this.advanceToPaymentStep();
        await this.selectNewCard();
        await this.confirmAndCompletePayment();
        await this.expectSuccessView();
    }

    /**
     * Activate (or renew) a package reusing an existing saved card (default mandate preselected).
     */
    async activateWithExistingCard(name: PackageName) {
        await this.openCheckout(name);
        await this.advanceToPaymentStep();
        // Existing default mandate is preselected; just confirm.
        await this.confirmAndCompletePayment();
        await this.expectSuccessView();
    }

    /**
     * Click the primary "continue" button on the non-payment checkout steps
     * (package overview + customer/company step). Stops once the payment step is shown.
     */
    async advanceToPaymentStep() {
        const confirmButton = this.page.getByTestId('confirm-payment-method-button');
        // The package-overview and customer steps each use a SaveView with a [data-testid=save-button].
        // The overview step keeps its save button disabled until the terms checkbox is accepted.
        for (let i = 0; i < 5; i++) {
            if (await confirmButton.isVisible().catch(() => false)) {
                return;
            }
            const save = this.page.locator('[data-testid="save-button"]:visible').first();
            await save.waitFor({ state: 'visible' }).catch(() => {});

            if (await save.isDisabled().catch(() => false)) {
                // Accept the terms & conditions checkbox to enable the save button.
                await this.page.locator('label.checkbox:visible, label.checkbox-line:visible').first().click().catch(() => {});
            }
            await save.click().catch(() => {});
            await this.page.waitForTimeout(400);
        }
    }

    private async selectNewCard() {
        // If a list of saved cards is shown, choose "Nieuwe kaart" first.
        const newCard = this.page.getByText(Labels.newCard, { exact: false }).first();
        if (await newCard.isVisible().catch(() => false)) {
            await newCard.click();
        }

        // Check the "save this card for periodic charges" row (required to create a mandate).
        // The row is a selectable list item wrapping a checkbox; clicking its text toggles it on.
        const saveCard = this.page.getByText(/periodieke aanrekeningen gebruiken|Sla deze kaart op/i).first();
        if (await saveCard.isVisible().catch(() => false)) {
            await saveCard.click();
        }

        // Pick the credit-card payment method row (label "Kredietkaart").
        const method = this.page.locator('.payment-selection-list label').filter({ hasText: /kredietkaart/i }).first();
        await method.click();
        // Wait for the pro-forma amount to settle after changing the method.
        await this.page.waitForTimeout(500);
    }

    /**
     * Click the confirm button, wait for the redirect to the mocked Mollie checkout page,
     * mark the payment as paid via the mocker and navigate back to the captured redirect URL.
     */
    private async confirmAndCompletePayment() {
        // Intercept the mocked Mollie checkout page so a redirect lands somewhere renderable.
        await this.page.route('https://molliecheckout/', route =>
            route.fulfill({
                contentType: 'text/html',
                body: '<html><body data-testid="mollie-mock-page">Mock Mollie checkout</body></html>',
            }),
        );

        // The backend (and therefore the MollieMocker) runs in this same worker process, so we can
        // read the payments it creates directly.
        const before = this.mollieMocker.payments.length;

        await this.page.getByTestId('confirm-payment-method-button').click();

        // Wait until the checkout has created a Mollie payment server-side.
        await expect.poll(() => this.mollieMocker.payments.length, { timeout: 15000 }).toBeGreaterThan(before);
        const payment = this.mollieMocker.getLastPayment();

        // A first/one-off card payment redirects the browser to the Mollie checkout page.
        // A recurring charge against an existing mandate completes without a redirect.
        const redirected = await this.page
            .waitForURL('https://molliecheckout/', { timeout: 4000 })
            .then(() => true)
            .catch(() => false);

        await this.mollieMocker.succeedPayment(payment);

        if (redirected && payment.redirectUrl) {
            await this.page.goto(payment.redirectUrl);
        }
    }

    private async expectSuccessView() {
        await expect(this.page.getByTestId('payment-success-view')).toBeVisible();
    }

    // ---- Assertions -------------------------------------------------------

    async assertStartTrialButtonVisible(name: PackageName) {
        await expect(this.packageRow(name)).toContainText(Labels.startTrialButton);
    }

    async assertStartTrialButtonNotVisible(name: PackageName) {
        await expect(this.packageRow(name)).not.toContainText(Labels.startTrialButton);
    }

    async assertActivateButtonVisible(name: PackageName) {
        await expect(this.packageRow(name)).toContainText(Labels.activateButton);
    }

    async assertReactivateButtonVisible(name: PackageName) {
        await expect(this.packageRow(name)).toContainText(Labels.reactivateButton);
    }

    async assertRenewButtonVisible(name: PackageName) {
        await expect(this.packageRow(name)).toContainText(Labels.renewButton);
    }

    async assertPackageActive(name: PackageName) {
        await expect(this.packageRow(name)).toContainText(Labels.active);
    }

    async assertTrialActive(name: PackageName) {
        await expect(this.packageRow(name)).toContainText(Labels.trialActive);
    }

    /**
     * On the payment step, a mandate (card) is required: the credit-card method option is shown.
     */
    async assertCardRequired() {
        await expect(this.page.getByTestId('payment-method-option').first()).toBeVisible();
    }

    async assertPaymentFailedWarningVisible() {
        await expect(this.page.getByText(Labels.paymentFailed).first()).toBeVisible();
    }

    async assertNoPaymentFailedWarning() {
        await expect(this.page.getByText(Labels.paymentFailed)).toHaveCount(0);
    }
}
