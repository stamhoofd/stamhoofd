import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Reusable flow + assertion helpers for the SAAS package activation / billing flow.
 *
 * The scenario drives the real dashboard UI. Payments are completed by a MollieMocker:
 * the checkout redirects to a mocked Mollie checkout page, the mocker marks the payment
 * paid (creating a mandate where needed) and the test navigates back to the captured
 * redirect URL where the dashboard polls the payment status and shows the success view.
 */
export class OnboardingScenario {
    readonly page: Page;

    constructor(options: { page: Page }) {
        this.page = options.page;
    }

    async assertStartOnboardingPage() {
        await expect(this.page.getByTestId('onboarding-start-view')).toBeVisible();
    }
}
