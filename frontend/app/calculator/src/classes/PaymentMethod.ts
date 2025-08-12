import { CalculationOptions } from './CalculationInput';
import { Country } from './Country';

export enum PaymentMethod {
    CreditCard = 'CreditCard',
    Payconiq = 'Payconiq',
    Bancontact = 'Bancontact',
    iDEAL = 'iDEAL',
    Transfer = 'Transfer',
    PointOfSale = 'PointOfSale',
}

export function getPaymentMethodName(method: PaymentMethod): string {
    switch (method) {
        case PaymentMethod.CreditCard:
            return 'Kredietkaart';
        case PaymentMethod.Payconiq:
            return 'Payconiq';
        case PaymentMethod.Bancontact:
            return 'Bancontact';
        case PaymentMethod.iDEAL:
            return 'iDEAL';
        case PaymentMethod.Transfer:
            return 'Overschrijving (manueel)';
        case PaymentMethod.PointOfSale:
            return 'Ter plaatse';
        default:
            console.warn('Unknown payment method:', method);
            return 'Unknown payment method';
    }
}

export function getPaymentMethodDescription(method: PaymentMethod): string {
    switch (method) {
        case PaymentMethod.Transfer:
            return 'Vink zelf aan dat je de betaling hebt ontvangen (manueel)';
        case PaymentMethod.PointOfSale:
            return 'Je regelt de betaling ter plaatse';
    }
    return '';
}

export function methodsEqual(a: PaymentMethod[], b: PaymentMethod[]): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (!b.includes(a[i])) {
            return false;
        }
    }
    return true;
}

export function calculatePaymentMethodUsage(methods: PaymentMethod[], options?: CalculationOptions): Map<PaymentMethod, number> {
    // Only a single method -> all usage will be that method
    if (methods.length === 1) {
        return new Map([[methods[0], 100_00]]);
    }

    if (methodsEqual(methods, [PaymentMethod.Transfer, PaymentMethod.PointOfSale])) {
        return new Map([
            [PaymentMethod.Transfer, 80_00], // 80% transfer
            [PaymentMethod.PointOfSale, 20_00], // 20% point of sale
        ]);
    }

    // If transfer and point of sale is combined with online payments, we'll assume ±20% goes to transfer and point of sale
    if (methods.includes(PaymentMethod.Transfer) && methods.includes(PaymentMethod.PointOfSale)) {
        const remaining = methods.filter(method => method !== PaymentMethod.Transfer && method !== PaymentMethod.PointOfSale);

        const usage = calculatePaymentMethodUsage(remaining, options);
        let totalUsed = 0;
        for (const [method, value] of usage) {
            const p = Math.round(value * 0.8);
            usage.set(method, p); // Distribute the remaining 80% evenly
            totalUsed += p;
        }
        const transferAndPointOfSale = 100_00 - totalUsed; // ± 20% left for both transfer and point of sale
        const transfer = Math.round(transferAndPointOfSale * 0.8); // 80% of 20% goes to transfer
        usage.set(PaymentMethod.Transfer, transfer);
        usage.set(PaymentMethod.PointOfSale, transferAndPointOfSale - transfer); // 20% of 20% goes to point of sale

        return usage;
    }

    // If transfer is combined with online payments, we'll assume ±20% goes to transfer
    if (methods.includes(PaymentMethod.Transfer)) {
        const remaining = methods.filter(method => method !== PaymentMethod.Transfer);

        const usage = calculatePaymentMethodUsage(remaining, options);
        let totalUsed = 0;
        for (const [method, value] of usage) {
            const p = Math.round(value * 0.8);
            usage.set(method, p); // Distribute the remaining 80% evenly
            totalUsed += p;
        }
        usage.set(PaymentMethod.Transfer, 100_00 - totalUsed); // 20% for transfer (± rounding errors)

        return usage;
    }

    // If transfer is combined with online payments, we'll assume ±10% goes to point of sale
    if (methods.includes(PaymentMethod.PointOfSale)) {
        const forcePercentage = 10_00;
        const remaining = methods.filter(method => method !== PaymentMethod.PointOfSale);

        const usage = calculatePaymentMethodUsage(remaining, options);
        let totalUsed = 0;
        for (const [method, value] of usage) {
            const p = Math.round(value * (100_00 - forcePercentage) / 100_00);
            usage.set(method, p); // Distribute the remaining 80% evenly
            totalUsed += p;
        }
        usage.set(PaymentMethod.PointOfSale, 100_00 - totalUsed); // 20% for transfer (± rounding errors)

        return usage;
    }

    // If transfer is combined with online payments, we'll assume ±20% goes to transfer
    if (methods.includes(PaymentMethod.CreditCard)) {
        const forcePercentage = options?.country === Country.NL ? 30_00 : 5_00;
        const remaining = methods.filter(method => method !== PaymentMethod.CreditCard);

        const usage = calculatePaymentMethodUsage(remaining, options);
        let totalUsed = 0;
        for (const [method, value] of usage) {
            const p = Math.round(value * (100_00 - forcePercentage) / 100_00);
            usage.set(method, p); // Distribute the remaining 80% evenly
            totalUsed += p;
        }
        usage.set(PaymentMethod.CreditCard, 100_00 - totalUsed); // 20% for transfer (± rounding errors)

        return usage;
    }

    if (methodsEqual(methods, [PaymentMethod.Payconiq, PaymentMethod.Bancontact])) {
        return new Map([
            [PaymentMethod.Payconiq, 60_00], // 60% Payconiq
            [PaymentMethod.Bancontact, 40_00], // 40% Bancontact
        ]);
    }

    if (methodsEqual(methods, [PaymentMethod.iDEAL, PaymentMethod.Bancontact])) {
        if (options?.country === Country.NL) {
            return new Map([
                [PaymentMethod.iDEAL, 95_00], // 95% iDEAL
                [PaymentMethod.Bancontact, 5_00], // 5% Bancontact
            ]);
        }

        return new Map([
            [PaymentMethod.Bancontact, 95_00], // 95% Bancontact
            [PaymentMethod.iDEAL, 5_00], // 5% iDEAL
        ]);
    }

    if (methodsEqual(methods, [PaymentMethod.iDEAL, PaymentMethod.Payconiq])) {
        if (options?.country === Country.NL) {
            // Weird setup, but ok
            return new Map([
                [PaymentMethod.iDEAL, 99_00],
                [PaymentMethod.Payconiq, 1_00],
            ]);
        }
        // Weird setup, but ok
        return new Map([
            [PaymentMethod.Payconiq, 95_00],
            [PaymentMethod.iDEAL, 5_00],
        ]);
    }

    if (methodsEqual(methods, [PaymentMethod.iDEAL, PaymentMethod.Bancontact, PaymentMethod.Payconiq])) {
        if (options?.country === Country.NL) {
            return new Map([
                [PaymentMethod.iDEAL, 94_00], // 70% iDEAL
                [PaymentMethod.Bancontact, 5_00], // 5% Bancontact
                [PaymentMethod.Payconiq, 1_00], // 1% Payconiq
            ]);
        }

        return new Map([
            [PaymentMethod.Payconiq, 59_00],
            [PaymentMethod.Bancontact, 39_00],
            [PaymentMethod.iDEAL, 2_00],
        ]);
    }

    console.warn('No payment method usage defined for methods:', methods);
    return new Map();
}
