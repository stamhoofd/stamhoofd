import { expect } from '@playwright/test';
import type { Page, Response } from '@playwright/test';
import { appToUri } from '@stamhoofd/structures';
import { WorkerData } from '../worker/WorkerData.js';

export enum DashboardTab {
    Events = 'events',
    Webshops = 'webshops',
}

const dashboardTabLabels: Record<DashboardTab, string> = {
    [DashboardTab.Events]: 'Activiteiten',
    [DashboardTab.Webshops]: 'Webshops',
};

/**
 * Whether the login was refused because the user still has to set up two-factor
 * authentication.
 */
async function isRequireMFASetup(response: Response): Promise<boolean> {
    const body = await response.json().catch(() => null) as { errors?: { code?: string }[] } | null;
    return body?.errors?.some(error => error.code === 'require_mfa_setup') ?? false;
}

export class DashboardPage {
    constructor(public readonly page: Page) {}

    private getOrganizationDashboardUrl(organizationUri: string) {
        return WorkerData.urls.dashboard + '/' + appToUri('dashboard') + '/' + organizationUri;
    }

    async goto() {
        await this.page.goto(WorkerData.urls.dashboard);
    }

    async login(options: {
        organizationUri: string;
        email: string;
        password: string;
    }) {
        const initialState = await this.openOrganizationDashboard({
            organizationUri: options.organizationUri,
        });

        if (initialState === 'dashboard') {
            return;
        }

        if (initialState === 'members-login') {
            await this.page.getByTestId('open-login-button').click();
        }

        const emailInput = this.page.getByTestId('email-input');

        await emailInput.click();
        await emailInput.fill(options.email);

        // Try to fix weird flaky tests where the password field ends up added to the email field
        await expect(emailInput).toHaveValue(options.email); // catch misfiling immediately

        const passwordInput = this.page.getByTestId('password-input');
        await passwordInput.click();
        await passwordInput.fill(options.password);
        await expect(passwordInput).toHaveValue(options.password);

        const tokenResponsePromise = this.page.waitForResponse((response) => {
            return response.url().includes('/oauth/token')
                && response.request().method() === 'POST';
        });

        await this.page.getByTestId('login-button').click();

        const tokenResponse = await tokenResponsePromise;
        if (!tokenResponse.ok()) {
            // A user that is required to have two-factor authentication (e.g. a platform
            // admin) has to enroll a second factor before the login is finished. Tests that
            // are not about 2FA shouldn't have to care, so we complete the enrollment here.
            if (await isRequireMFASetup(tokenResponse)) {
                // Imported here and not at the top: this file is loaded (via helpers/index)
                // before the test environment is loaded, and the backend test helpers read
                // STAMHOOFD while they are being evaluated.
                const { TwoFactorFlow } = await import('../../flows/TwoFactorFlow.js');
                await new TwoFactorFlow({ page: this.page }).completeForcedSetup();
            } else {
                throw new Error(`Login failed with status ${tokenResponse.status()}`);
            }
        }

        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
            const dashboardVisible = await this.page.locator('.account-switcher').isVisible().catch(() => false);
            if (dashboardVisible) {
                return;
            }

            await this.page.waitForTimeout(250);
        }

        throw new Error('Expected dashboard after login, got login');
    }

    async openOrganizationDashboard(options: {
        organizationUri: string;
    }) {
        await this.page.goto(this.getOrganizationDashboardUrl(options.organizationUri));

        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
            const dashboardVisible = await this.page.getByText('Meer', { exact: true }).isVisible().catch(() => false);
            if (dashboardVisible) {
                return 'dashboard' as const;
            }

            const loginVisible = await this.page.getByTestId('email-input').isVisible().catch(() => false);
            if (loginVisible) {
                return 'login' as const;
            }

            const membersLoginVisible = await this.page.getByTestId('members-home-view').isVisible().catch(() => false);
            if (membersLoginVisible) {
                return 'members-login' as const;
            }

            const loginHeadingVisible = await this.page.getByRole('heading', { name: 'Inloggen op Stamhoofd' }).isVisible().catch(() => false);
            if (loginHeadingVisible) {
                return 'login' as const;
            }

            await this.page.waitForTimeout(250);
        }

        throw new Error(
            `Expected login or dashboard after opening organization route ${options.organizationUri}`,
        );
    }

    async openTab(tab: DashboardTab) {
        await this.page
            .getByTestId('tab-button')
            .filter({ hasText: dashboardTabLabels[tab] })
            .click();
    }

    async startSignup() {
        await this.page.getByTestId('signup-link').click();
    }
}
