import { Formatter } from '@stamhoofd/utility';
import { CalculationInput } from './CalculationInput';
import { ModuleType } from './ModuleType';
import { Country } from './Country';

export type CalculationRemark = {
    id?: string;
    text: string;
    type?: 'info' | 'warning' | 'error';
};

export type CalculationLine = {
    title: string;
    description: string;
    totalPrice: number;

    calculationDescription?: string;

    remarks?: CalculationRemark[];
};

export class FixedPriceCalculationLine implements CalculationLine {
    title: string = '';
    description: string = '';

    amount: number = 0;
    unitPrice: number = 0;

    constructor(options: Partial<FixedPriceCalculationLine>) {
        this.title = options.title || '';
        this.description = options.description || '';
        this.amount = options.amount || 0;
        this.unitPrice = options.unitPrice || 0;
    }

    get totalPrice() {
        return this.amount * this.unitPrice;
    }

    get calculationDescription() {
        return `${Formatter.integer(this.amount)} x ${Formatter.price(this.unitPrice)}`;
    }
}

export class VolumePercentageCalculationLine implements CalculationLine {
    title: string = '';
    description: string = '';

    /**
     * Price volume, e.g. 1000 euro
     */
    volume: number = 0;
    percentage: number = 0; // saved as per ten thousand, so 100 (1_00) = 1%
    vatPercentage: number = 0; // 21 or 0

    constructor(options: Partial<VolumePercentageCalculationLine>) {
        this.title = options.title || '';
        this.description = options.description || '';
        this.volume = options.volume || 0;
        this.percentage = options.percentage || 0;
        this.vatPercentage = options.vatPercentage ?? 0; // e.g. 1.21 for 21% VAT
    }

    get totalPrice() {
        return Math.ceil(this.volume * this.percentage * (this.vatPercentage + 100) / 1000000);
    }

    get calculationDescription() {
        if (this.vatPercentage) {
            return `${Formatter.price(this.volume)} x ${Formatter.percentage(this.percentage)} + 21% BTW`;
        }
        return `${Formatter.price(this.volume)} x ${Formatter.percentage(this.percentage)}`;
    }
}

export class CalculationGroup implements CalculationLine {
    title: string = '';
    description: string = '';
    lines: CalculationLine[] = [];
    customRemarks?: CalculationRemark[];

    constructor(options: Partial<CalculationGroup> = {}) {
        this.title = options.title || '';
        this.description = options.description || '';
        this.lines = options.lines || [];
        this.customRemarks = options.customRemarks || [];
    }

    get remarks() {
        return [
            ...(this.lines.flatMap(line => line.remarks || [])),
            ...(this.customRemarks || []),
        ];
    }

    get totalPrice() {
        return this.lines.reduce((sum, line) => sum + line.totalPrice, 0);
    }

    get calculationDescription() {
        return this.lines.filter(l => l.totalPrice !== 0).map(line => line.calculationDescription).filter(d => !!d).join('\n');
    }
}

export class CalculationOutput {
    /**
     * Monthly costs + setup fees
     */
    fixedFees: CalculationGroup = new CalculationGroup({
        title: 'Vaste kosten',
    });

    serviceFees: CalculationGroup = new CalculationGroup({
        title: 'Servicekosten',
    });

    transactionFees: CalculationGroup = new CalculationGroup({
        title: 'Transactiekosten',
    });

    get remarks() {
        const remarks = [
            ...this.fixedFees.remarks || [],
            ...this.serviceFees.remarks || [],
            ...this.transactionFees.remarks || [],
        ];

        const cleanedRemarks: CalculationRemark[] = [];
        // Remove remarks with same id
        const foundRemarks: Set<string> = new Set();
        for (const remark of remarks) {
            if (!remark.id) {
                cleanedRemarks.push(remark);
                continue;
            }
            if (foundRemarks.has(remark.id)) {
                continue;
            }
            foundRemarks.add(remark.id);
            cleanedRemarks.push(remark);
        }

        return cleanedRemarks;
    }

    get totalPrice() {
        return this.fixedFees.totalPrice + this.serviceFees.totalPrice + this.transactionFees.totalPrice;
    }

    getSummary(input: CalculationInput) {
        if (input.amount <= 0) {
            return new CalculationGroup({});
        }

        if (input.module === ModuleType.Members) {
            return new CalculationGroup({
                title: 'Totale kost per inschrijving',
                description: input.withVAT ? 'incl. 21% BTW' : 'excl. BTW',
                lines: [
                    {
                        title: 'Vaste kosten per inschrijving',
                        description: '',
                        totalPrice: Math.round(this.fixedFees.totalPrice / input.amount),
                    },

                    {
                        title: 'Servicekosten per inschrijving',
                        description: 'Kost voor het gebruik van Stamhoofd',
                        totalPrice: Math.round(this.serviceFees.totalPrice / input.amount),
                    },

                    {
                        title: 'Gemiddelde transactiekost',
                        description: input.options.country === Country.BE ? `Gaat naar Stripe, Mollie of Payconiq` : `Gaat naar Stripe of Mollie`,
                        totalPrice: Math.round(this.transactionFees.totalPrice / input.amount),
                    },
                ],
            });
        }

        if (input.module === ModuleType.Webshops) {
            return new CalculationGroup({
                title: 'Totale kost per stuk',
                description: input.withVAT ? 'incl. 21% BTW' : 'excl. BTW',
                lines: [
                    {
                        title: 'Vaste kosten per stuk',
                        description: '',
                        totalPrice: Math.round(this.fixedFees.totalPrice / input.amount),
                    },

                    {
                        title: 'Servicekosten per stuk',
                        description: 'Kost voor het gebruik van Stamhoofd',
                        totalPrice: Math.round(this.serviceFees.totalPrice / input.amount),
                    },

                    {
                        title: 'Gemiddelde transactiekost',
                        description: input.options.country === Country.BE ? `Gaat naar Stripe, Mollie of Payconiq` : `Gaat naar Stripe of Mollie`,
                        totalPrice: Math.round(this.transactionFees.totalPrice / input.amount),
                    },
                ],
            });
        }

        return new CalculationGroup({
            title: 'Totale kost per ticket',
            description: input.withVAT ? 'incl. 21% BTW' : 'excl. BTW',
            lines: [
                {
                    title: 'Vaste kosten per ticket',
                    description: '',
                    totalPrice: Math.round(this.fixedFees.totalPrice / input.amount),
                },

                {
                    title: 'Servicekosten per ticket',
                    description: 'Kost voor het gebruik van Stamhoofd',
                    totalPrice: Math.round(this.serviceFees.totalPrice / input.amount),
                },

                {
                    title: 'Gemiddelde transactiekost',
                    description: input.options.country === Country.BE ? `Gaat naar Stripe, Mollie of Payconiq` : `Gaat naar Stripe of Mollie`,
                    totalPrice: Math.round(this.transactionFees.totalPrice / input.amount),
                },
            ],
        });
    }
}
