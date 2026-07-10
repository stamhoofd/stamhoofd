import type { Locator, Page } from '@playwright/test';
import type { PaymentMethod, Product } from '@stamhoofd/structures';
import { ProductType } from '@stamhoofd/structures';
import type { TestAddress, TestBirthDay } from '../../../flows/WebshopOrderFlow.js';

export class EditOrderView {
    constructor(public readonly page: Page) {
    }

    private get view(): Locator {
        return this.page.getByTestId('edit-order-view');
    }

    async fillCustomerData({ firstName, lastName, email, phone, birthDay, gender, address }: Partial<{ firstName: string; lastName: string; email: string; phone: string; birthDay: TestBirthDay; gender: 'Male' | 'Female' | 'Other'; address: TestAddress }>) {
        if (firstName) {
            await this.fillFirstName(firstName);
        }

        if (lastName) {
            await this.fillLastName(lastName);
        }

        if (email) {
            await this.fillEmail(email);
        }

        if (phone) {
            await this.phone(phone);
        }

        if (birthDay) {
            await this.view.getByTestId('day-select').selectOption({ label: String(birthDay.day) });
            await this.view.getByTestId('month-select').selectOption({ index: birthDay.month });
            await this.view.getByTestId('year-select').selectOption({ label: String(birthDay.year) });
        }

        if (gender) {
            await this.view.locator('label.radio', { has: this.page.locator(`input[name="customer-sex"][value="${gender}"]`) }).click();
        }

        if (address) {
            await this.view.locator('select[name="country"]').selectOption(address.country);
            await this.view.locator('input[name="street-address"]').fill(`${address.street} ${address.number}`);
            await this.view.locator('input[name="postal-code"]').fill(address.postalCode);
            await this.view.locator('input[name="city"]').fill(address.city);
            await this.view.locator('input[name="city"]').blur();
        }
    }

    async addProduct({product, amount}: {product: Product, amount: number}) {
        await this.page.getByTestId('add-product-button').click();

        await this.page.getByTestId('product-box').filter({ hasText: product.name }).click();

        const amountInput = this.page.getByTestId('amount-number-input').locator('input');
        await amountInput.fill(amount.toString());

        await this.page.getByTestId('cart-item-view').getByTestId('save-button').click();

        if (product.type === ProductType.Ticket) {
             for (let i = 0; i < amount; i++) {
                // select first available seat
                await this.page.locator('.seat:not(.selected):not(.occupied):not(.highlighted):not(.space)').first()
                .click();
            }

            await this.page.getByTestId('confirm-seats-button').click();
        }
    }

    async selectPaymentMethod(paymentMethod: PaymentMethod) {
        await this.page.getByTestId('payment-method-option').filter({
            has: this.page.locator('[value="' + paymentMethod + '"]')
        }).click();
    }

    async save() {
        await this.page.getByTestId('edit-order-view').getByTestId('save-button').click();

        // wait for the view to close
        await  this.page.getByTestId('edit-order-view').waitFor({ state: 'detached' });
    }

    private async fillFirstName(firstName: string) {
        await this.page.getByTestId('first-name-input').fill(firstName);
    }

    private async fillLastName(lastName: string) {
        await this.page.getByTestId('last-name-input').fill(lastName);
    }

    private async fillEmail(email: string) {
        await this.page.getByTestId('email-input').fill(email);
    }

    private async phone(phone: string) {
        await this.page.getByTestId('phone-input').fill(phone);
    }
}
