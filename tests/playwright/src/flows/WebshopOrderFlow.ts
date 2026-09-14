import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { WebshopOrderMode } from '@stamhoofd/structures';

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
/** CustomerInputs generates its own radio group name, so match on the prefix */
const GENDER_INPUT = 'input[name^="sex"]';

export class WebshopOrderFlow {
    private readonly page: Page;
    private readonly cartEnabled: boolean;
    private readonly bulk: boolean;
    /** Global seat index per product name, so products sharing a seating plan never pick the same seat */
    private seatCounter = new Map<string, number>();

    constructor(page: Page, options: { cartEnabled?: boolean; orderMode?: WebshopOrderMode }) {
        this.page = page;
        this.bulk = options.orderMode === WebshopOrderMode.Bulk;
        this.cartEnabled = options.orderMode ? options.orderMode === WebshopOrderMode.Cart : (options.cartEnabled ?? true);
    }

    async goto(url: string) {
        await this.page.goto(url);
        await expect(this.page.locator('.modern-webshop-view')).toBeVisible({ timeout: 15000 });
    }

    // --- Bulk mode (modern view) --------------------------------------------

    private bulkRow(productName: string) {
        return this.page.getByTestId('bulk-product-row').filter({ hasText: productName }).first();
    }

    /**
     * Set the amount of a product (or one of its prices) with the stepper buttons.
     */
    async setBulkAmount(productName: string, amount: number, priceName?: string) {
        const row = this.bulkRow(productName);
        const scope = priceName ? row.locator('.stacked-box .st-list-item').filter({ hasText: priceName }).first() : row;
        const stepper = scope.getByTestId('bulk-stepper').first();
        await expect(stepper).toBeVisible();
        for (let i = 0; i < amount; i++) {
            await stepper.locator('button.plus').click();
        }
    }

    /**
     * Type an amount in the field next to the stepper
     */
    async typeBulkAmount(productName: string, amount: number, priceName?: string) {
        const input = this.bulkAmount(productName, priceName);
        await input.fill(amount.toString());
        await input.press('Enter');
    }

    /**
     * The editable amount field next to the stepper (empty while the amount is 0)
     */
    bulkAmount(productName: string, priceName?: string) {
        const row = this.bulkRow(productName);
        const scope = priceName ? row.locator('.stacked-box .st-list-item').filter({ hasText: priceName }).first() : row;
        return scope.getByTestId('bulk-amount').first();
    }

    async toggleBulkProduct(productName: string) {
        await this.bulkRow(productName).getByTestId('bulk-checkbox').click();
    }

    async selectBulkPrice(productName: string, priceName: string) {
        await this.bulkRow(productName).locator('label').filter({ hasText: priceName }).first().click();
    }

    /**
     * Press "Bestellen" in bulk mode. The next step (seats, details, customer, ...) is pushed on the webshop.
     */
    async startBulkOrder() {
        await this.page.getByTestId('bulk-order-button').click();
    }

    /**
     * Pick `count` seats in the bulk seats step and confirm.
     */
    async chooseBulkSeats(productName: string, count: number) {
        const seatsView = this.page.getByTestId('bulk-seats-view');
        await expect(seatsView).toBeVisible({ timeout: 15000 });
        for (let i = 0; i < count; i++) {
            await seatsView.getByTestId('seat-button').nth(this.seatCounter.get(productName) ?? 0).click();
            this.seatCounter.set(productName, (this.seatCounter.get(productName) ?? 0) + 1);
        }
        await seatsView.getByTestId('confirm-seats-button').click();
    }

    detailsStep() {
        return this.page.getByTestId('details-step');
    }

    detailsItem(index: number) {
        return this.detailsStep().getByTestId('details-item').nth(index);
    }

    /**
     * Fill the inputs of one unit in the details step.
     */
    async fillDetails(index: number, options: { option?: string; field?: string; customer?: { firstName: string; lastName: string; email?: string; phone?: string } } = {}) {
        const item = this.detailsItem(index);
        await expect(item).toBeVisible({ timeout: 15000 });
        if (options.option) {
            await item.locator('label').filter({ hasText: options.option }).first().click();
        }
        if (options.field !== undefined) {
            // Custom fields are the only inputs without a name attribute
            await item.locator('input.input:not([name])').first().fill(options.field);
        }
        if (options.customer) {
            await item.locator('input[name="fname"]').fill(options.customer.firstName);
            await item.locator('input[name="lname"]').fill(options.customer.lastName);
            if (options.customer.email) {
                await item.locator('input[name="email"]').fill(options.customer.email);
            }
            if (options.customer.phone) {
                await item.locator('input[name="mobile"]').fill(options.customer.phone);
            }
        }
    }

    async submitDetails() {
        await this.detailsStep().getByTestId('save-button').click();
    }

    /**
     * Open the form of a product. A webshop with one product and no cart shows the form on the page itself, or a
     * single order button when it has a description. Both render together with the webshop view.
     */
    private async openProduct(name: string): Promise<Locator> {
        const embedded = this.page.locator('.modern-webshop').getByTestId('cart-item-view');
        if (await embedded.count() > 0) {
            await expect(embedded).toBeVisible();
            return embedded;
        }

        const orderButton = this.page.getByTestId('single-order-button');
        if (await orderButton.count() > 0) {
            await orderButton.click();
        } else {
            await this.page.getByTestId('product-box').filter({ hasText: name }).first().click();
        }

        const cartItemView = this.page.getByTestId('cart-item-view');
        await expect(cartItemView).toBeVisible();
        return cartItemView;
    }

    /**
     * Add a product to the cart. For seated tickets, pass the number of seats to pick.
     */
    async addProduct(name: string, options: { seats?: number; count?: number; customer?: { firstName: string; lastName: string; email?: string; birthDay?: TestBirthDay } } = {}) {
        const seats = options.seats ?? 0;
        const count = options.seats ?? options.count ?? 1;

        const cartItemView = await this.openProduct(name);

        if (count > 1) {
            await cartItemView.getByTestId('amount-number-input').locator('input').fill(count.toString());
        }
        if (options.customer) {
            await cartItemView.locator('input[name="fname"]').fill(options.customer.firstName);
            await cartItemView.locator('input[name="lname"]').fill(options.customer.lastName);
            if (options.customer.email) {
                await cartItemView.locator('input[name="email"]').fill(options.customer.email);
            }
            if (options.customer.birthDay) {
                await this.fillBirthDay(cartItemView, options.customer.birthDay);
            }
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

        // Adding to the cart stays in the webshop and confirms it with a toast
        if (this.cartEnabled) {
            await expect(this.page.getByTestId('cart-added-toast').first()).toBeVisible();
            await expect(this.page.getByTestId('cart-item-view')).toHaveCount(0);
        }
    }

    /**
     * Open the cart with the cart button in the bar of the webshop. Does nothing when the cart is already open: the
     * checkout progress replaces the bar there.
     */
    async openCart() {
        if (await this.page.getByTestId('cart-checkout-button').isVisible()) {
            return;
        }
        await this.page.getByTestId('cart-button').click();
        await expect(this.page.getByTestId('cart-checkout-button')).toBeVisible();
    }

    /**
     * Go to the checkout. For cart shops the cart is opened from the bar; for no-cart shops the customer step
     * already opened automatically after adding.
     */
    async goToCheckout() {
        if (this.cartEnabled) {
            await this.openCart();
            await this.page.getByTestId('cart-checkout-button').click();
        }
        await expect(this.page.getByTestId('customer-step')).toBeVisible({ timeout: 15000 });
    }

    /**
     * Pick the contact person of the order from the per-item customers (customer step)
     */
    async selectMainCustomer(name: string) {
        await this.page.getByTestId('main-customer-list').locator('label').filter({ hasText: name }).first().click();
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
            await this.selectGender(step, gender);
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
        await expect(step.locator(GENDER_INPUT)).toHaveCount(fields.gender ? 3 : 0);
        await expect(step.locator('input[name="street-address"]')).toHaveCount(fields.address ? 1 : 0);
    }

    /**
     * Delivery flow: open the checkout and fill the (separate) delivery address step, which comes
     * before the customer step. Returns once the customer step is visible.
     */
    async fillDeliveryAddressStep(address: TestAddress) {
        if (this.cartEnabled) {
            await this.openCart();
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

    private async selectGender(scope: Locator, gender: 'Male' | 'Female' | 'Other') {
        await scope.locator('label.radio', { has: this.page.locator(`${GENDER_INPUT}[value="${gender}"]`) }).click();
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
        // Below the cart preview when the screen is wide enough for its own column (900px, see PreviewPanel), in the toolbar of the step otherwise
        const wide = (this.page.viewportSize()?.width ?? 0) >= 900;
        const button = wide
            ? this.page.getByTestId('preview-confirm-button')
            : this.page.getByTestId('payment-step').getByTestId('save-button');
        await button.click();
    }

    // --- Assertions / post-order helpers ----------------------------------

    async expectOrderConfirmed(options?: { immediate?: boolean }) {
        await expect(this.page.getByTestId('order-view')).toBeVisible({ timeout: 15000 });
        // if (options?.immediate ?? true) {
        //    await expect(this.page.getByTestId('order-view')).toContainText($t('%Y5'));
        // } else {
        //    await expect(this.page.getByTestId('order-view')).toContainText($t('%Y6'));
        // }
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
