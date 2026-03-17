// test should always be imported first
import { test } from '../test-fixtures/base';

// other imports
import { expect, Page } from '@playwright/test';
import {
    Organization,
    OrganizationFactory,
    RegisterCodeFactory,
} from '@stamhoofd/models';
import { AcquisitionType } from '@stamhoofd/structures';
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

    test.describe('organization name', () => {
        test('should show error if empty', async ({ page, pages }) => {
            await pages.dashboard.goto();

            // click signup
            await pages.dashboard.startSignup();

            // step 1
            const step1 = new SignupGeneralPage(page);
            await step1.selectType('Jeugd');
            await step1.fillCity('Wetteren');
            await step1.selectCountry('BE');
            await step1.checkRecommended();
            await step1.goNext();

            // check if error is shown
            await expect(page.getByTestId('name-box')).toContainText('Vul de naam van jouw vereniging in');
        });

        test('should show error if too short', async ({ page, pages }) => {
            await pages.dashboard.goto();

            // click signup
            await pages.dashboard.startSignup();

            // step 1
            const step1 = new SignupGeneralPage(page);
            await step1.fillName('abc');
            await step1.selectType('Jeugd');
            await step1.fillCity('Wetteren');
            await step1.selectCountry('BE');
            await step1.checkRecommended();
            await step1.goNext();

            // check if error is shown
            await expect(page.getByTestId('name-box')).toContainText('De naam van jouw vereniging is te kort');
        });

        test('should show error if too long', async ({ page, pages }) => {
            await pages.dashboard.goto();

            // click signup
            await pages.dashboard.startSignup();

            // step 1
            const step1 = new SignupGeneralPage(page);
            await step1.fillName('a'.repeat(101));
            await step1.selectType('Jeugd');
            await step1.fillCity('Wetteren');
            await step1.selectCountry('BE');
            await step1.checkRecommended();
            await step1.goNext();

            // check if error is shown
            await expect(page.getByTestId('name-box')).toContainText('De naam van jouw vereniging is te lang');
        });

        test('should show error if exists', async ({ page, pages }) => {
            // create existing organization
            await new OrganizationFactory({
                name: 'existingName',
            }).create();

            await pages.dashboard.goto();

            // click signup
            await pages.dashboard.startSignup();

            // step 1
            const step1 = new SignupGeneralPage(page);
            await step1.fillName('existingName');
            await step1.selectType('Jeugd');
            await step1.fillCity('Wetteren');
            await step1.selectCountry('BE');
            await step1.checkRecommended();
            await step1.goNext();

            // check if error is shown
            await expect(page.getByTestId('name-box')).toContainText('Er bestaat al een vereniging met deze naam');
        });
    });

    test.describe('password', () => {
        test('should show error if too short', async ({ page, pages }) => {
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
            const step2 = new SignupAccountPage(page);
            await step2.fillFirstName('voornaam');
            await step2.fillLastName('achternaam');
            await step2.fillEmail('test@test.be');
            await step2.fillPassword('short');
            await step2.checkDataAgreement();
            await step2.checkAll();
            await step2.goNext();

            // check if error is shown
            await expect(page.getByTestId('password-box')).toContainText('Jouw wachtwoord moet uit minstens 8 karakters bestaan.');
        });

        test('should show error if empty', async ({ page, pages }) => {
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
            const step2 = new SignupAccountPage(page);
            await step2.fillFirstName('voornaam');
            await step2.fillLastName('achternaam');
            await step2.fillEmail('test@test.be');
            await step2.checkDataAgreement();
            await step2.checkAll();
            await step2.goNext();

            // check if error is shown
            await expect(page.getByTestId('password-box')).toContainText('Jouw wachtwoord moet uit minstens 8 karakters bestaan.');
        });
    });

    test.describe('registerCode', () => {
        test('happy flow', async ({ page }) => {
            const referrer = await (new OrganizationFactory({ name: 'referrer' })).create();
            const registerCode = await (new RegisterCodeFactory({ organization: referrer })).create();

            // step 1
            const step1 = new SignupGeneralPage(page);
            await step1.goto({ query: { code: registerCode.code, org: referrer.name } });
            await step1.fillName('Vereniging2');
            await step1.selectType('Jeugd');
            await step1.fillCity('Wetteren');
            await step1.selectCountry('BE');
            // do not check recommended (should happen automatically)

            // acquisition type selection should not be visible
            await expect(page.getByTestId('acquisition-title')).not.toBeVisible();
            await expect(page.getByTestId('referrer-success-message')).toBeVisible();

            await step1.goNext();

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

            // check if organization has acquisitionType Recommended
            const newOrganization = await Organization.select().where('name', 'Vereniging2').first(true);
            expect(newOrganization.privateMeta.acquisitionTypes).toHaveLength(1);
            expect(newOrganization.privateMeta.acquisitionTypes).toContain(AcquisitionType.Recommended);

            // todo: check if code was applied
        });

        test('should show error if invalid', async ({ page }) => {
            // step 1
            const step1 = new SignupGeneralPage(page);
            await step1.goto({ query: { code: 'invalidCode', org: 'invalidOrg' } });
            await step1.fillName('Vereniging');
            await step1.selectType('Jeugd');
            await step1.fillCity('Wetteren');
            await step1.selectCountry('BE');

            // wait for name input to appear
            await expect(page.getByTestId('signup-form')).toContainText('De gebruikte doorverwijzingslink is niet meer geldig');

            // checkboxes for acquisition types should be visible
            await expect(page.getByTestId('acquisition-title')).toBeVisible();

            // referrer success message should not be visible
            await expect(page.getByTestId('referrer-success-message')).not.toBeVisible();
        });
    });
});

// pages
class SignupGeneralPage {
    constructor(public readonly page: Page) {
    }

    async goto({ query }: { query?: { code: string; org: string } }) {
        let url = WorkerData.urls.dashboard + '/aansluiten';
        if (query) {
            url += '?code=' + encodeURIComponent(query.code) + '&org=' + encodeURIComponent(query.org);
        }
        await this.page.goto(url);
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
        await this.checkAquisitionTypes([AcquisitionType.Recommended]);
    }

    async checkAquisitionTypes(acquisitionTypes: AcquisitionType[]) {
        for (const acquisitionType of acquisitionTypes) {
            await this.page.getByTestId('acquisition-' + acquisitionType).check();
        }
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

    async checkAll() {
        await this.checkPrivacy();
        await this.checkTerms();
        await this.checkDataAgreement();
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
        await this.checkAll();
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
