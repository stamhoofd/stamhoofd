import type { Page } from '@playwright/test';
import { appToUri } from '@stamhoofd/structures';
import { WorkerData } from '../worker/WorkerData.js';

export enum DashboardTab {
    Events = 'events',
}

const dashboardTabLabels: Record<DashboardTab, string> = {
    [DashboardTab.Events]: 'Activiteiten',
};

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

        const emailInput = this.page.getByTestId('email-input');

        await emailInput.click();
        await emailInput.fill(options.email);

        const passwordInput = this.page.getByTestId('password-input');
        await passwordInput.click();
        await passwordInput.fill(options.password);

        const tokenResponsePromise = this.page.waitForResponse((response) => {
            return response.url().includes('/oauth/token')
                && response.request().method() === 'POST';
        });

        await this.page.getByTestId('login-button').click();

        const tokenResponse = await tokenResponsePromise;
        if (!tokenResponse.ok()) {
            throw new Error(`Login failed with status ${tokenResponse.status()}`);
        }

        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
            const dashboardVisible = await this.page.getByTestId('organization-name').isVisible().catch(() => false);
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
            const dashboardVisible = await this.page.getByTestId('organization-name').isVisible().catch(() => false);
            if (dashboardVisible) {
                return 'dashboard' as const;
            }

            const loginVisible = await this.page.getByTestId('email-input').isVisible().catch(() => false);
            if (loginVisible) {
                return 'login' as const;
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
