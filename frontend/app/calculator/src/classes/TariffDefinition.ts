import { SimpleError } from '@simonbackx/simple-errors';
import { CalculationInput } from './CalculationInput';
import { CalculationGroup, CalculationLine, CalculationOutput, CalculationRemark, FixedPriceCalculationLine, VolumePercentageCalculationLine } from './CalculationOutput';
import { ModuleType } from './ModuleType';
import { calculatePaymentMethodUsage, getPaymentMethodName, PaymentMethod } from './PaymentMethod';
import { Formatter } from '@stamhoofd/utility';

export class TransactionFee {
    provider: string | null = null; // the payment provider for which this fee applies, e.g., 'Stripe', 'Mollie', etc.
    onlyRegisteredBusinesses = false; // if true, this fee only applies to registered businesses, not individuals

    /**
     * Fixed transaction fee per order
     */
    fixed: number;

    maximum: number | null = null;

    /**
    * Fixed transaction fee per ticket sale (for most payment providers, it is per order, but some do charge per ticket)
    */
    fixedPerTicket: number;

    /**
    * Percentage transaction fee, based on price
    * (saved as per ten thousand, so 100 (1_00) = 1%)
    */
    percentage: number;

    /**
     * Whether this provider charges a way higher fee than normal
     */
    isInflated = false; // if true, this fee is manually inflated to ensure it is at least a certain amount

    constructor(options: Partial<TransactionFee> = {}) {
        this.onlyRegisteredBusinesses = options.onlyRegisteredBusinesses ?? false;
        this.provider = options.provider || null;
        this.fixed = options.fixed || 0;
        this.fixedPerTicket = options.fixedPerTicket || 0;
        this.percentage = options.percentage || 0;
        this.isInflated = options.isInflated || false;
        this.maximum = options.maximum ?? null; // maximum amount for this fee, if set, it will not allow more than this amount
    }

    getDescription(method: PaymentMethod) {
        const descriptions: string[] = [];
        if (this.fixed) {
            descriptions.push(`${Formatter.price(this.fixed)}`);
        }
        if (this.fixedPerTicket) {
            descriptions.push(`${Formatter.price(this.fixedPerTicket)} per ticket`);
        }
        if (this.percentage) {
            descriptions.push(`${Formatter.percentage(this.percentage)}`);
        }

        if (descriptions.length === 0) {
            return 'Gratis';
        }

        return descriptions.join(' + ') + ' per betaling gaat naar ' + (this.provider || getPaymentMethodName(method));
    }
}

export class Fees {
    setupCost = 0; // one-time setup costs
    setupCostOnlinePayments = 0; // one-time setup costs
    perMonth = 0;

    perUnit = 0; // * amount (per ticket or registration)
    perPerson = 0; // per person

    perOrder = 0; // * orderCount
    percentage = 0; // * totalPrice (saved as per ten thousand, so 100 (1_00) = 1%)
    maxPerUnit: number | null;
    maxPerOrder: number | null;
    minPerUnit = 0; // minimum amount for this fee, if set, it will not allow less than this amount

    includedFreeAmount = 0; // amount of tickets or members included for free

    constructor(options: Partial<Fees> = {}) {
        this.setupCost = options.setupCost || 0;
        this.setupCostOnlinePayments = options.setupCostOnlinePayments || 0;
        this.perMonth = options.perMonth || 0;
        this.perUnit = options.perUnit || 0;
        this.perPerson = options.perPerson || 0;
        this.perOrder = options.perOrder || 0;
        this.percentage = options.percentage || 0;
        this.includedFreeAmount = options.includedFreeAmount || 0;
        this.maxPerUnit = options.maxPerUnit ?? null; // maximum amount for this fee, if set, it will not allow more than this amount
        this.maxPerOrder = options.maxPerOrder ?? null; // maximum amount for this fee
        this.minPerUnit = options.minPerUnit ?? 0; // minimum amount for this fee, if set, it will not allow less than this amount
    }
}

export class Tier {
    fees: Fees;

    /**
     * If multiple fees are added to a payment method, they present multiple options, so we can use the cheapest one.
     */
    transactionFees: Map<PaymentMethod, TransactionFee[]>;

    /**
     * Minimum amount of tickets or registrations for this tier that will get charged
     */
    minimumAmount: number | null = null;
    minimumPersons: number | null = null; // minimum persons for this tier, if set, it will not allow less than this amount of persons

    maximumUnitPrice: number | null = null; // maximum unit price for this tier, if set, it will not allow more than this price per unit
    maximumAmount: number | null = null; // maximum amount of tickets or members that are allowed within this tier

    constructor(options: Partial<Tier>) {
        this.fees = options.fees || new Fees();
        this.transactionFees = options.transactionFees || new Map<PaymentMethod, TransactionFee[]>();
        this.minimumAmount = options.minimumAmount ?? null;
        this.minimumPersons = options.minimumPersons ?? null; // minimum persons for this tier, if set, it will not allow less than this amount of persons
        this.maximumAmount = options.maximumAmount ?? null;
        this.maximumUnitPrice = options.maximumUnitPrice ?? null; // if set, it will not allow more than this price per unit
    }

    calculateVAT(price: number, input: CalculationInput) {
        if (!input.withVAT) {
            return price;
        }
        return Math.round(price * 1.21); // 21% VAT
    }

    calculate(input: CalculationInput): CalculationOutput {
        const output = new CalculationOutput();

        // Payment methods
        const paymentMethods = input.requestedPaymentMethods.filter(method => this.transactionFees.has(method));

        if (paymentMethods.length === 0) {
            // Select POS
            paymentMethods.push(PaymentMethod.PointOfSale);
        }

        // Start with the service fees
        if (this.fees.setupCost) {
            const title = 'Setupkosten';

            output.serviceFees.lines.push(
                {
                    title,
                    description: '',
                    totalPrice: this.calculateVAT(this.fees.setupCost, input),
                },
            );
        }

        if (this.fees.setupCostOnlinePayments && (paymentMethods.filter(p => p !== PaymentMethod.Transfer && p !== PaymentMethod.PointOfSale).length > 0)) {
            const title = 'Setupkosten voor online betalingen';

            output.serviceFees.lines.push(
                {
                    title,
                    description: '',
                    totalPrice: this.calculateVAT(this.fees.setupCostOnlinePayments, input),
                },
            );
        }

        if (this.fees.perUnit) {
            let title = '';
            switch (input.module) {
                case ModuleType.Tickets:
                    title = 'Servicekosten per ticket';
                    break;
                case ModuleType.Members:
                    title = 'Prijs per inschrijving';
                    break;
                case ModuleType.Webshops:
                    title = 'Servicekost per artikel';
                    break;
            }

            output.serviceFees.lines.push(
                new FixedPriceCalculationLine({
                    title: title,
                    amount: input.amount,
                    unitPrice: this.calculateVAT(this.fees.perUnit, input),
                }),
            );
        }

        if (this.fees.perPerson) {
            let title = '';
            switch (input.module) {
                case ModuleType.Tickets:
                    title = 'Servicekosten per persoon';
                    break;
                case ModuleType.Members:
                    title = 'Prijs per lid';
                    break;
                case ModuleType.Webshops:
                    title = 'Servicekost per persoon';
                    break;
            }

            output.serviceFees.lines.push(
                new FixedPriceCalculationLine({
                    title: title,
                    description: (this.minimumPersons && input.persons < this.minimumPersons) ? `Minimum van ${this.minimumPersons} personen vereist` : '',
                    amount: (this.minimumPersons && input.persons < this.minimumPersons) ? this.minimumPersons : input.persons,
                    unitPrice: this.calculateVAT(this.fees.perPerson, input),
                }),
            );
        }

        if (this.fees.perOrder) {
            let title = 'Servicekosten per bestelling';
            let description = `Berekend op gemiddeld ${input.averageAmountPerOrder} items per bestelling`;
            switch (input.module) {
                case ModuleType.Tickets:
                    title = 'Servicekosten per ticket';
                    description = `Gemiddeld ${input.averageAmountPerOrder} tickets per bestelling`;
                    break;
                case ModuleType.Members:
                    title = 'Prijs per bestelling';
                    description = `Gemiddeld ${input.averageAmountPerOrder} inschrijvingen per bestelling`;
                    break;
                case ModuleType.Webshops:
                    title = 'Servicekost per artikel';
                    description = `Gemiddeld ${input.averageAmountPerOrder} artikels per bestelling`;
                    break;
            }

            output.serviceFees.lines.push(
                new FixedPriceCalculationLine({
                    title,
                    description,
                    amount: input.orderCount,
                    unitPrice: this.calculateVAT(this.fees.perOrder, input),
                }),
            );
        }

        if (this.fees.percentage) {
            for (const product of input.products) {
                const z = new VolumePercentageCalculationLine({
                    title: 'Servicekosten op volume',
                    description: 'Berekend op totale omzet',
                    volume: product.volume,
                    percentage: this.fees.percentage,
                    vatPercentage: input.withVAT ? 21 : 0,
                });
                if (this.fees.maxPerUnit && z.totalPrice / product.amount > this.fees.maxPerUnit) {
                    const z = new FixedPriceCalculationLine({
                        title: 'Servicekosten op volume',
                        description: 'Maximum kost per stuk',
                        amount: product.amount,
                        unitPrice: this.calculateVAT(this.fees.maxPerUnit, input),
                    });
                    output.serviceFees.lines.push(
                        z,
                    );
                }
                else if (this.fees.minPerUnit && z.totalPrice / product.amount < this.fees.minPerUnit) {
                    const z = new FixedPriceCalculationLine({
                        title: 'Servicekosten op volume',
                        description: 'Minimum kost per stuk',
                        amount: product.amount,
                        unitPrice: this.calculateVAT(this.fees.minPerUnit, input),
                    });
                    output.serviceFees.lines.push(
                        z,
                    );
                }
                else {
                    output.serviceFees.lines.push(
                        z,
                    );
                }
            }
        }

        const distribution = calculatePaymentMethodUsage(paymentMethods);

        if (distribution.size === 0) {
            // something went wrong, no distribution
            console.error('No payment method distribution found for', input, paymentMethods);
            throw new SimpleError({
                code: 'TARIFF_NO_PAYMENT_METHODS',
                message: 'No payment methods found for this tier',
                human: 'We konden geen betaalmethodes vinden om de transactiekosten te berekenen.',
            });
        }

        for (const [paymentMethod, usagePercentage] of distribution) {
            const volume = Math.round(input.volume * usagePercentage / 100_00); // Convert to cents
            const transactionCount = Math.round(Math.min(input.nonZeroAmount, input.orderCount) * usagePercentage / 100_00); // Convert to cents
            const ticketsCount = Math.round(input.nonZeroAmount * usagePercentage / 100_00); // Convert to cents

            const fees = this.transactionFees.get(paymentMethod);
            if (!fees) {
                continue;
            }
            let feeCalculationCheapest: CalculationLine | null = null;

            // Search for the cheapest fee
            for (const fee of fees) {
                if (fee.onlyRegisteredBusinesses && !input.registeredBusiness) {
                    continue; // Skip this fee if it is only for registered businesses and the input is not
                }
                const remarks: CalculationRemark[] = [];
                if (fee.isInflated) {
                    remarks.push({
                        id: 'inflated-transaction-fees',
                        text: `Sommige transactiekosten zijn hoger dan de standaard prijzen van betaalproviders, hier zit dus verborgen marge op.`,
                        type: 'warning',
                    });
                }

                const group = new CalculationGroup({
                    title: `${getPaymentMethodName(paymentMethod)}`,
                    description: (fee.provider && fees.length ? `Via ${fee.provider}` : '') + (fee.provider && fees.length && usagePercentage < 100_00 ? '\n' : '') + (usagePercentage < 100_00 ? `Geschat gebruik ${Formatter.percentage(usagePercentage)}` : ''),
                    customRemarks: remarks,
                    lines: [
                        new VolumePercentageCalculationLine({
                            title: 'Transactiekosten op volume',
                            volume,
                            percentage: fee.percentage,
                            vatPercentage: input.withVAT ? 21 : 0,
                        }),
                        new FixedPriceCalculationLine({
                            title: 'Transactiekosten op aantal stuks',
                            amount: transactionCount,
                            unitPrice: this.calculateVAT(fee.fixed, input),
                        }),
                        new FixedPriceCalculationLine({
                            title: 'Transactiekosten op aantal stuks',
                            amount: ticketsCount,
                            unitPrice: this.calculateVAT(fee.fixedPerTicket, input),
                        }),
                    ],
                });

                if (!feeCalculationCheapest || group.totalPrice < feeCalculationCheapest.totalPrice) {
                    feeCalculationCheapest = group;
                }
            }

            // Append cheapest
            if (feeCalculationCheapest) {
                output.transactionFees.lines.push(feeCalculationCheapest);
            }
        }

        output.transactionFees.customRemarks = [];
        for (const requested of input.requestedPaymentMethods) {
            if (!this.transactionFees.has(requested)) {
                // Add remark
                output.transactionFees.customRemarks!.push({
                    id: `unsupported-payment-method-${requested}`,
                    text: `De betaalmethode ${getPaymentMethodName(requested)} is niet beschikbaar op dit platform`,
                    type: 'warning',
                });
            }
        }

        return output;
    }

    isEnabledFor(input: CalculationInput): boolean {
        if (this.maximumAmount !== null && input.amount > this.maximumAmount) {
            return false;
        }
        if (this.maximumUnitPrice !== null) {
            for (const product of input.products) {
                if (product.unitPrice > this.maximumUnitPrice) {
                    return false;
                }
            }
        }
        return true;
    }
}

export class Tiers {
    tiers: Tier[] = [];

    constructor(tiers: Tier[] = []) {
        this.tiers = tiers;
    }

    getTier(input: CalculationInput): Tier | null {
        // Loop all tiers, and return the cheapest one that is enabled
        let cheapestTier: { tier: Tier; price: number } | null = null;

        for (const tier of this.tiers) {
            if (tier.isEnabledFor(input)) {
                try {
                    const calculation = tier.calculate(input);
                    if (cheapestTier === null || calculation.totalPrice < cheapestTier.price) {
                        cheapestTier = { tier, price: calculation.totalPrice };
                    }
                }
                catch (e) {
                    // If the calculation fails, we skip this tier
                    console.error('Failed to calculate tier', tier, 'for input', input, e);
                }
            }
        }

        return cheapestTier?.tier ?? null;
    }
}

export class TariffDefinition {
    name: string = '';
    description: string = '';
    modules: Map<ModuleType, Tiers>;

    constructor(options: Partial<TariffDefinition>) {
        this.name = options.name || '';
        this.description = options.description || '';
        this.modules = options.modules || new Map<ModuleType, Tiers>();
    }

    getTier(input: CalculationInput): Tier | null {
        const tiers = this.modules.get(input.module);
        if (!tiers) {
            return null;
        }
        return tiers.getTier(input);
    }

    calculate(input: CalculationInput): { tier: Tier; output: CalculationOutput } | null {
        const tier = this.getTier(input);
        if (!tier) {
            return null;
        }
        const output = tier.calculate(input);
        return { tier, output };
    }
}
