// test should always be imported first
import { test } from '../test-fixtures/base';

// other imports
import { expect, Page } from '@playwright/test';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers';

/**
 * Onboarding a new organization
 */
test.describe('Onboarding', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test.afterAll(async () => {
        await WorkerData.resetDatabase();
    });

    test('happy path', async ({ page, pages }) => {
        await pages.dashboard.goto();

        // click signup
        await pages.dashboard.startSignup();

        const name = 'Vereniging';

        // step 1
        await (new SignupGeneralPage(page)).completeHappyFlow({
            name,
            type: 'Jeugd',
            city: 'Wetteren',
            country: 'BE',
        });

        // step 2
        await (new SignupAccountPage(page)).completeHappyFlow({
            firstName: 'voornaam',
            lastName: 'achternaam',
            email: 'test@test.be',
            password: 'testAbc123456',
        });

        // fill in code
        await (new ConfirmEmailPage(page)).fillCode('111111');

        // wait for data-testid element to appear (h1 with name of organization)
        await page.getByTestId('organization-name').waitFor();

        // check if page contains name of organization
        await expect(page.getByTestId('organization-name')).toContainText(
            name,
        );
    });
});

// pages
class SignupGeneralPage {
    constructor(public readonly page: Page) {

    }

    async selectType(type: string) {
        await this.page
            .getByTestId('organization-type-option')
            .filter({ hasText: type })
            .click();
    }

    async fillName(name: string) {
        await this.page
            .getByTestId('organization-name-input')
            .fill(name);
    }

    async fillCity(city: string) {
        await this.page.getByTestId('city-only-input').fill(city);
    }

    async selectCountry(country: string) {
        await this.page.getByTestId('country-select').selectOption(country);
    }

    async checkRecommended() {
        await this.page.getByTestId('acquisition-recommended-checkbox').check();
    }

    async goNext() {
        await this.page.getByTestId('signup-next-button').click();
    }

    async completeHappyFlow({ name, type, city, country }: { name: string; type: string; city: string; country: string }) {
        await this.selectType(type);
        await this.fillName(name);
        await this.fillCity(city);
        await this.selectCountry(country);
        await this.checkRecommended();
        await this.goNext();
    }
}

class SignupAccountPage {
    constructor(public readonly page: Page) {

    }

    async fillFirstName(firstName: string) {
        await this.page.getByTestId('first-name-input').fill(firstName);
    }

    async fillLastName(lastName: string) {
        await this.page.getByTestId('last-name-input').fill(lastName);
    }

    async fillEmail(email: string) {
        await this.page.getByTestId('email-input').fill(email);
    }

    async fillPassword(password: string) {
        await this.page.getByTestId('password-input').fill(password);
    }

    async checkPrivacy() {
        await this.page.getByTestId('accept-privacy-input').check();
    }

    async checkTerms() {
        await this.page.getByTestId('accept-terms-input').check();
    }

    async checkDataAgreement() {
        await this.page.getByTestId('accept-data-agreement-input').check();
    }

    async goNext() {
        await this.page.getByTestId('signup-account-button').click();
    }

    async completeHappyFlow({ firstName, lastName, email, password }: { firstName: string; lastName: string; email: string; password: string }) {
        await this.fillFirstName(firstName);
        await this.fillLastName(lastName);
        await this.fillEmail(email);
        await this.fillPassword(password);
        await this.checkPrivacy();
        await this.checkTerms();
        await this.checkDataAgreement();
        await this.goNext();
    }
}

class ConfirmEmailPage {
    constructor(public readonly page: Page) {}

    async fillCode(code: string) {
        const parts = code.split('');

        const input = this.page.getByTestId('code-input');

        for (let i = 0; i < 6; i++) {
            const part = parts[i];

            await input.locator('input').nth(i).fill(part);
        }
    }
}
