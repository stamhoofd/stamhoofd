import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export interface TestAddress {
    street: string;
    number: string;
    postalCode: string;
    city: string;
    /** ISO country code, e.g. 'FR' (non BE/NL avoids the postal-code database lookup) */
    country: string;
}

export interface TestBirthDay {
    day: number;
    /** 1-12 */
    month: number;
    year: number;
}

/**
 * Drives the public webshop SPA through a complete order: adding products (with optional seats),
 * the cart, the customer step, payment selection, and the resulting order / ticket views.
 *
 * Pass `cartEnabled` so the flow knows whether adding a product opens the cart (multi-item shops)
 * or jumps straight into the checkout steps (single-item / no-cart shops).
 */
export class WebshopOrderFlow {
    private readonly page: Page;
    private readonly cartEnabled: boolean;
    /** Global seat index per product name, so products sharing a seating plan never pick the same seat */
    private seatCounter = new Map<string, number>();

    constructor(page: Page, options: { cartEnabled: boolean }) {
        this.page = page;
        this.cartEnabled = options.cartEnabled;
    }

    async goto(url: string) {
        await this.page.goto(url);
        await expect(this.page.getByTestId('product-box').first()).toBeVisible({ timeout: 15000 });
    }

    /**
     * Add a product to the cart. For seated tickets, pass the number of seats to pick.
     */
    async addProduct(name: string, options: { seats?: number; count?: number } = {}) {
        const seats = options.seats ?? 0;
        const count = options.seats ?? options.count ?? 1;

        // If the cart popup is still open from a previous add, go back to the shop first
        const addMore = this.page.getByTestId('cart-add-more-button');
        if (await addMore.isVisible().catch(() => false)) {
            await addMore.click();
        }

        await this.page.getByTestId('product-box').filter({ hasText: name }).first().click();

        const cartItemView = this.page.getByTestId('cart-item-view');
        await expect(cartItemView).toBeVisible();

        if (count > 1) {
            await cartItemView.getByTestId('amount-number-input').locator('input').fill(count.toString());
        }
        await cartItemView.getByTestId('save-button').click();

        if (seats > 0) {
            const seatsView = this.page.getByTestId('choose-seats-view');
            await expect(seatsView).toBeVisible();
            for (let i = 0; i < seats; i++) {
                await seatsView.getByTestId('seat-button').nth(this.seatCounter.get(name) ?? 0).click();
                this.seatCounter.set(name, (this.seatCounter.get(name) ?? 0) + 1);
            }
            await seatsView.getByTestId('confirm-seats-button').click();
        }

        // Wait for cart view
        if (this.cartEnabled) {
            // Wait for cart view to be visible to avoid fkalyness
            await expect(this.page.getByTestId('cart-add-more-button')).toBeVisible();
        }
    }

    /**
     * Go to the checkout. For cart shops the cart popup is open after the last add; for no-cart
     * shops the customer step already opened automatically after adding.
     */
    async goToCheckout() {
        if (this.cartEnabled) {
            await this.page.getByTestId('cart-checkout-button').click();
        }
        await expect(this.page.getByTestId('customer-step')).toBeVisible({ timeout: 15000 });
    }

    async fillCustomer(options: { firstName?: string; lastName?: string; email?: string; birthDay?: TestBirthDay; gender?: 'Male' | 'Female' | 'Other'; address?: TestAddress } = {}) {
        const { firstName = 'John', lastName = 'Doe', email = 'john.doe@test.be', birthDay, gender, address } = options;
        const step = this.page.getByTestId('customer-step');
        await step.locator('input[name="fname"]').fill(firstName);
        await step.locator('input[name="lname"]').fill(lastName);
        await step.locator('input[name="email"]').fill(email);

        if (birthDay) {
            await this.fillBirthDay(step, birthDay);
        }
        if (gender) {
            await this.selectGender(step, gender, 'sex');
        }
        if (address) {
            await this.fillAddressInputs(step, address);
        }

        await step.getByTestId('save-button').click();
    }

    /**
     * Assert the customer step is showing (or hiding) the birth day, gender and address inputs.
     */
    async expectCustomerFields(fields: { birthDay: boolean; gender: boolean; address: boolean }) {
        const step = this.page.getByTestId('customer-step');
        await expect(step).toBeVisible({ timeout: 15000 });
        await expect(step.getByTestId('day-select')).toHaveCount(fields.birthDay ? 1 : 0);
        await expect(step.locator('input[name="sex"]')).toHaveCount(fields.gender ? 3 : 0);
        await expect(step.locator('input[name="street-address"]')).toHaveCount(fields.address ? 1 : 0);
    }

    /**
     * Delivery flow: open the checkout and fill the (separate) delivery address step, which comes
     * before the customer step. Returns once the customer step is visible.
     */
    async fillDeliveryAddressStep(address: TestAddress) {
        if (this.cartEnabled) {
            await this.page.getByTestId('cart-checkout-button').click();
        }
        const step = this.page.getByTestId('address-step');
        await expect(step).toBeVisible({ timeout: 15000 });
        await this.fillAddressInputs(step, address);
        await step.getByTestId('save-button').click();
        await expect(this.page.getByTestId('customer-step')).toBeVisible({ timeout: 15000 });
    }

    private async fillBirthDay(scope: Locator, birthDay: TestBirthDay) {
        await scope.getByTestId('day-select').selectOption({ label: String(birthDay.day) });
        // Option index 0 is the placeholder, so month M is at index M
        await scope.getByTestId('month-select').selectOption({ index: birthDay.month });
        await scope.getByTestId('year-select').selectOption({ label: String(birthDay.year) });
    }

    private async selectGender(scope: Locator, gender: 'Male' | 'Female' | 'Other', name: string) {
        await scope.locator('label.radio', { has: this.page.locator(`input[name="${name}"][value="${gender}"]`) }).click();
    }

    private async fillAddressInputs(scope: Locator, address: TestAddress) {
        await scope.locator('select[name="country"]').selectOption(address.country);
        await scope.locator('input[name="street-address"]').fill(`${address.street} ${address.number}`);
        await scope.locator('input[name="postal-code"]').fill(address.postalCode);
        await scope.locator('input[name="city"]').fill(address.city);
        // Blur to let the address validate before the step is submitted
        await scope.locator('input[name="city"]').blur();
    }

    async selectPaymentMethod(name: string) {
        await this.page
            .locator('.payment-selection-list label')
            .filter({ hasText: name })
            .click();
    }

    async confirmPayment() {
        await this.page.getByTestId('payment-step').getByTestId('save-button').click();
    }

    // --- Assertions / post-order helpers ----------------------------------

    async expectOrderConfirmed(options?: { immediate?: boolean }) {
        await expect(this.page.getByTestId('order-view')).toBeVisible({ timeout: 15000 });
        if (options?.immediate ?? true) {
            await expect(this.page.getByTestId('order-view')).toContainText($t('%Y5'));
        } else {
            await expect(this.page.getByTestId('order-view')).toContainText($t('%Y6'));
        }
        await expect(this.page.getByTestId('order-number')).not.toBeEmpty();
    }

    async expectPaymentPending() {
        await this.expectOrderConfirmed();
        await expect(this.page.locator('.order-view .icon.clock').first()).toBeVisible();
    }

    async expectTicketsDownloadable(options?: { immediate?: boolean }) {
        await this.expectOrderConfirmed(options);
        await expect(this.page.getByTestId('tickets-section')).toBeVisible();
        await expect(this.page.getByTestId('download-tickets-button')).toBeVisible();
    }

    async expectTicketCount(count: number) {
        await expect(this.page.getByTestId('ticket-list-item')).toHaveCount(count);
    }

    async openFirstTicketQR() {
        const single = this.page.getByTestId('view-ticket-button');
        if (await single.isVisible().catch(() => false)) {
            await single.click();
        } else {
            await this.page.getByTestId('ticket-list-item').first().click();
        }
        await expect(this.page.getByTestId('detailed-ticket-view')).toBeVisible();
        await expect(this.page.getByTestId('qr-code')).toBeVisible();
    }

    async expectNoTicketsYet() {
        await this.expectOrderConfirmed();
        await expect(this.page.getByTestId('tickets-section')).toHaveCount(0);
        await expect(this.page.getByTestId('download-tickets-button')).toHaveCount(0);
    }

    async expectTransferInstructions() {
        const view = this.page.getByTestId('transfer-payment-view');
        await expect(view).toBeVisible({ timeout: 15000 });
        // The IBAN configured in TestWebshops (BE56 5871 2795 2688)
        await expect(view).toContainText('BE56');
    }

    async continueFromTransfer() {
        await this.page.getByTestId('transfer-continue-button').click();
    }

    async expectBackOnPaymentSelection() {
        await expect(this.page.getByTestId('payment-step')).toBeVisible({ timeout: 15000 });
    }
}
