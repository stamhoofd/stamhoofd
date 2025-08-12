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
    registeredBusiness = true;
    withVAT = false;

    products: CalculationProduct[] = []; // products that are part of the calculation, e.g. different ticket types or registrations

    /**
     * For some services, we need to know the amount of persons.
     */
    customPersons: number | null = null; // total amount of visitors or members
    customAverageAmountPerOrder: number | null = null; // average amount of tickets or registrations per order

    requestedPaymentMethods: PaymentMethod[]; // payment methods the user wants to use

    options: CalculationOptions;

    constructor(options: Partial<CalculationInput> = {}) {
        this.module = options.module || ModuleType.Tickets;
        this.products = options.products ?? [];
        this.customAverageAmountPerOrder = options.averageAmountPerOrder ?? null;
        this.requestedPaymentMethods = options.requestedPaymentMethods ?? [];
        this.options = options.options ?? { country: Country.BE };
        this.customPersons = options.persons ?? null;
        this.registeredBusiness = options.registeredBusiness ?? true;
        this.withVAT = options.withVAT ?? false;
    }

    get averageAmountPerOrder() {
        return this.customAverageAmountPerOrder ?? this.suggestedAverageAmountPerOrder;
    }

    set averageAmountPerOrder(value: number) {
        this.customAverageAmountPerOrder = value;
    }

    get suggestedAverageAmountPerOrder() {
        if (this.module === ModuleType.Members) {
            return 1.3;
        }

        const product = this.products[0];
        if (!product) {
            return 3;
        }

        if (product.unitPrice < 5_00) {
            return 5;
        }

        if (product.unitPrice < 10_00) {
            return 4;
        }

        if (product.unitPrice < 30_00) {
            return 3;
        }

        if (product.unitPrice < 80_00) {
            return 2.6;
        }

        return 2;
    }

    get persons() {
        return this.customPersons ? Math.min(this.maximumPersons, Math.max(this.minimumPersons, this.customPersons)) : this.suggestedPersons;
    }

    get suggestedPersons() {
        return Math.max(...this.products.map(p => p.amount), this.minimumPersons);
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
