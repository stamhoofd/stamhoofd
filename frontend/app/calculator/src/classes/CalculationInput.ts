/**
 * Input:
 *
 * - amount: of tickets or members (= amount)
 * - averageRegistrationsPerMember: average amount of registrations per member
 * - averageAmountPerOrder: amount of tickets/registratinos per order (average, is a guess) (averageAmountPerOrder)
 * - orderCount: expected amount of orders (calculated from amount and averageAmountPerOrder)
 * - registrationsCount: expected amount of registrations (calculated from amount and averageRegistrationsPerMember)
 */

import { Country } from './Country';
import { ModuleType } from './ModuleType';
import { PaymentMethod } from './PaymentMethod';

export class CalculationProduct {
    unitPrice = 10_00; // Price per ticket or registration
    amount = 1_000; // total amount of visitors or members

    constructor(options: Partial<CalculationProduct> = {}) {
        this.unitPrice = options.unitPrice ?? 10_00;
        this.amount = options.amount ?? 1_000;
    }

    get volume() {
        return this.amount * this.unitPrice;
    }
}

export class CalculationInput {
    module: ModuleType; // the module for which this input is calculated

    products: CalculationProduct[] = []; // products that are part of the calculation, e.g. different ticket types or registrations

    /**
     * For some services, we need to know the amount of persons.
     */
    customPersons: number | null = null; // total amount of visitors or members
    averageAmountPerOrder = 4; // average amount of tickets or registrations per order

    requestedPaymentMethods: PaymentMethod[]; // payment methods the user wants to use

    options: CalculationOptions;

    constructor(options: Partial<CalculationInput> = {}) {
        this.module = options.module || ModuleType.Tickets;
        this.products = options.products ?? [];
        this.averageAmountPerOrder = options.averageAmountPerOrder ?? 4;
        this.requestedPaymentMethods = options.requestedPaymentMethods ?? [];
        this.options = options.options ?? { country: Country.BE };
        this.customPersons = options.persons ?? null;
    }

    get persons() {
        return this.customPersons ? Math.min(this.maximumPersons, Math.max(this.minimumPersons, this.customPersons)) : this.suggestedPersons;
    }

    get suggestedPersons() {
        return this.maximumPersons;
    }

    get maximumPersons() {
        return this.products.reduce((total, product) => total + product.amount, 0);
    }

    get minimumPersons() {
        if (this.products.length === 0) {
            return 0;
        }
        return Math.min(...this.products.map(p => p.amount));
    }

    get amount() {
        return this.products.reduce((total, product) => total + product.amount, 0);
    }

    get nonZeroAmount() {
        return this.products.reduce((total, product) => total + (product.unitPrice > 0 ? product.amount : 0), 0);
    }

    get orderCount(): number {
        return Math.ceil(this.amount / this.averageAmountPerOrder);
    }

    get volume() {
        return this.products.reduce((total, product) => total + product.volume, 0);
    }
}

export type CalculationOptions = {
    country: Country;
};
