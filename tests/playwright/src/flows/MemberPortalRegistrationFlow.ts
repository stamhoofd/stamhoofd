import { Page, test } from "@playwright/test";
import { Pages } from "../helpers";

export class MemberPortalRegistrationFlow {
    private readonly page: Page;
    private readonly pages: Pages;

    constructor(options: { page: Page; pages: Pages }) {
        this.page = options.page;
        this.pages = options.pages;
    }

    async startRegister({
        organizationName,
        groupName,
        memberName,
    }: {
        organizationName: string;
        groupName: string;
        memberName: string;
    }) {
        // go to member portal
        await this.pages.memberPortal.goto();

        // click register member
        const registerButton = this.page.getByTestId("register-member-button");
        await registerButton.waitFor();
        await registerButton.click();

        const memberButton = this.page
            .getByTestId("member-button")
            .filter({ hasText: memberName });
        await memberButton.waitFor();
        await memberButton.click();

        // search organization
        const organizationSearch = this.page.getByTestId(
            "organization-search-input",
        );
        await organizationSearch.click();
        await organizationSearch.fill(organizationName);

        // click organization
        await this.page
            .getByTestId("organization-button")
            .filter({ hasText: organizationName })
            .click();

        // click group
        await this.page
            .getByTestId("group-button")
            .filter({ hasText: groupName })
            .click();

        // add to cart
        await this.page.getByTestId("save-button").click();
    }

    async continueMemberStep() {
        await this.page
            .getByTestId("member-step")
            .filter({
                has: this.page.getByTestId("first-name-input"),
            })
            .getByTestId("save-button")
            .click();
    }

    async expectUitpasInput() {
        const uitpasInput = this.page.getByTestId("uitpas-input");
        await test.expect(uitpasInput).toBeVisible();
        return uitpasInput;
    }

    async completeUitpasStep(uitpasNumber?: string, expectSocialTariffStatus?: string) {
        const uitpasInput = await this.expectUitpasInput();

        if (uitpasNumber) {
            await uitpasInput.fill(uitpasNumber);
        }

        if(expectSocialTariffStatus) {
            const statusDiv = this.page.getByTestId("social-tariff-status");
            await test.expect(statusDiv).toContainText(expectSocialTariffStatus);
        }

        // click next
        const uitpasStep = this.page
            .getByTestId("member-step")
            .filter({ has: uitpasInput });
        await uitpasStep.getByTestId("save-button").click();
        return uitpasStep;
    }

    async goToCheckout() {
        const checkoutButton = this.page.getByTestId("go-to-checkout-button");
        await test.expect(checkoutButton).toBeVisible();

        // go to checkout
        await checkoutButton.click();

        // close toast
        await this.page.getByTestId("toast-box").click();
    }

    async expectTotalText(text: string) {
        const totalText = this.page.getByTestId("total-text");
        await test.expect(totalText).toContainText(text);
    }

    async confirmPaymentMethod() {
        await this.page.getByTestId("confirm-payment-method-button").click();
    }

    async expectSuccessView() {
        await test
            .expect(this.page.getByTestId("registration-success-view"))
            .toBeVisible();
    }

    async expectFinancialSupportStep() {
        const financialSupportBox = this.page.getByTestId(
            "financial-support-box",
        );

        await test.expect(financialSupportBox).toBeVisible();

        const checkbox = financialSupportBox.getByTestId("checkbox");
        const checkboxInput = checkbox.locator("input");

        await test.expect(checkboxInput).not.toBeDisabled();
    }

    async expectFinancialSupportNotToBeDisabled() {
        const financialSupportBox = this.page.getByTestId(
            "financial-support-box",
        );

        const checkbox = financialSupportBox.getByTestId("checkbox");
        const checkboxInput = checkbox.locator("input");

        await test.expect(checkboxInput).not.toBeDisabled();
    }

    async continueFinancialSupportStep() {
        // click next
        const financialSupportStep = this.page
            .getByTestId("member-step")
            .filter({
                has: this.page.getByTestId("financial-support-box"),
            });

        await financialSupportStep.getByTestId("save-button").click();
    }
}
