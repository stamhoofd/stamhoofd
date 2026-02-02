import { AutoEncoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

import { PaymentCustomer } from '../PaymentCustomer.js';
import { downgradePaymentMethodV150, PaymentMethod, PaymentMethodHelper, PaymentMethodV150 } from '../PaymentMethod.js';
import { PaymentProvider } from '../PaymentProvider.js';
import { PaymentStatus } from '../PaymentStatus.js';
import { PaymentType, PaymentTypeHelper } from '../PaymentType.js';
import { TransferSettings } from '../webshops/TransferSettings.js';
import { upgradePriceFrom2To4DecimalPlaces } from '../upgradePriceFrom2To4DecimalPlaces.js';

export class Payment extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new EnumDecoder(PaymentType), version: 353 })
    type: PaymentType = PaymentType.Payment;

    /// Last selected payment method. Nullable if none has been selected
    @field({ decoder: new EnumDecoder(PaymentMethodV150), nullable: true })
    @field({
        decoder: new EnumDecoder(PaymentMethod),
        version: 151,
        downgrade: downgradePaymentMethodV150,
    })
    method: PaymentMethod;

    @field({ decoder: new EnumDecoder(PaymentStatus) })
    status: PaymentStatus = PaymentStatus.Created;

    @field({ decoder: new EnumDecoder(PaymentProvider), nullable: true, version: 152 })
    provider: PaymentProvider | null = null;

    @field({ decoder: PaymentCustomer, nullable: true, version: 321 })
    customer: PaymentCustomer | null = null;

    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    price = 0;

    @field({ decoder: IntegerDecoder, nullable: true, version: 92 })
    @field({ ...upgradePriceFrom2To4DecimalPlaces, nullable: true })
    freeContribution: number | null = null;

    // Transfer description if paid via transfer
    @field({ decoder: StringDecoder, nullable: true })
    transferDescription: string | null = null;

    @field({ decoder: TransferSettings, nullable: true, version: 160 })
    transferSettings: TransferSettings | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    paidAt: Date | null = null;

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date();

    @field({ decoder: DateDecoder })
    updatedAt: Date = new Date();

    @field({ decoder: StringDecoder, nullable: true, version: 324 })
    organizationId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 344 })
    payingOrganizationId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 392 })
    invoiceId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 393 })
    payingUserId: string | null = null;

    get isPending() {
        return this.status !== PaymentStatus.Succeeded && this.status !== PaymentStatus.Failed;
    }

    get isOverDue() {
        const daysToPay = 7;
        return this.isPending && this.createdAt < new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * daysToPay);
    }

    get isSucceeded() {
        return this.status === PaymentStatus.Succeeded;
    }

    get isFailed() {
        return this.status === PaymentStatus.Failed;
    }

    get canChangeStatus() {
        return this.method === PaymentMethod.Transfer || this.method === PaymentMethod.PointOfSale || this.method === PaymentMethod.Unknown;
    }

    get title() {
        if (this.method !== PaymentMethod.Unknown) {
            if (this.type !== PaymentType.Payment) {
                return $t(`e13af8ee-f442-4a98-b3e6-6f3d84fba30c`) + ' ' + PaymentMethodHelper.getName(this.method);
            }
            return PaymentMethodHelper.getNameCapitalized(this.method);
        }

        return Formatter.capitalizeFirstLetter(PaymentTypeHelper.getName(this.type));
    }

    get theme() {
        if (this.type === PaymentType.Reallocation) {
            return 'theme-secundary';
        }
        if (this.type === PaymentType.Chargeback || this.type === PaymentType.Refund) {
            return 'theme-error';
        }
    }

    getHTMLTable(): string {
        let str = `<table width="100%" cellspacing="0" cellpadding="0" class="email-data-table"><tbody>`;

        /**
         * Replacement.create({
                    token: "priceToPay",
                    value: forcePayment?.status !== PaymentStatus.Succeeded ? Formatter.price(forcePayment?.price ?? 0) : ""
                }),
                Replacement.create({
                    token: "paymentMethod",
                    value: forcePayment?.method ? PaymentMethodHelper.getName(forcePayment.method) : PaymentMethodHelper.getName(this.data.paymentMethod)
                }),
                Replacement.create({
                    token: "transferDescription",
                    value: forcePayment?.status !== PaymentStatus.Succeeded && forcePayment?.method === PaymentMethod.Transfer ? (forcePayment?.transferDescription ?? "") : ""
                }),
                Replacement.create({
                    token: "transferBankAccount",
                    value: forcePayment?.status !== PaymentStatus.Succeeded && forcePayment?.method === PaymentMethod.Transfer ? ((webshop?.meta.transferSettings.iban ? webshop?.meta.transferSettings.iban : organization.meta.transferSettings.iban) ?? "") : ""
                }),
                Replacement.create({
                    token: "transferBankCreditor",
                    value: forcePayment?.status !== PaymentStatus.Succeeded && forcePayment?.method === PaymentMethod.Transfer ? ((webshop?.meta.transferSettings.creditor ? webshop?.meta.transferSettings.creditor : organization.meta.transferSettings.creditor) ?? organization.name) : ""
                }),
         */
        const data = [
            {
                title: $t(`07e7025c-0bfb-41be-87bc-1023d297a1a2`),
                value: this.method ? Formatter.capitalizeFirstLetter(PaymentMethodHelper.getName(this.method)) : '',
            },
            {
                title: $t(`18aed6d0-0880-4d06-9260-fe342e6e8064`),
                value: this.status !== PaymentStatus.Succeeded ? Formatter.price(this?.price ?? 0) : Formatter.price(0),
            },
            ...(
                this.method === PaymentMethod.Transfer
                    ? [
                            {
                                title: $t(`136b7ba4-7611-4ee4-a46d-60758869210f`),
                                value: this.transferDescription ?? '',
                            },
                            {
                                title: $t(`1fbed7d4-9e6e-4c87-b7fe-a9059aef2492`),
                                value: this.transferSettings?.iban ?? '',
                            },
                            {
                                title: $t(`31c28f13-d3b8-42ee-8979-c8224633237e`),
                                value: this.transferSettings?.creditor ?? '',
                            },
                        ]
                    : []
            ),

        ];

        for (const replacement of data) {
            if (replacement.value.length == 0) {
                continue;
            }
            str += `<tr><td><h4>${Formatter.escapeHtml(replacement.title)}</h4></td><td>${Formatter.escapeHtml(replacement.value)}</td></tr>`;
        }

        return str + '</tbody></table>';
    }
}

export class Settlement extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    reference: string;

    @field({ decoder: DateDecoder })
    settledAt: Date;

    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    amount: number;

    /**
     * Fee for the payment provider for the individual payment
     * Only set if it is witheld from the settlement/payout
     */
    @field({ decoder: IntegerDecoder, version: 195 })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    fee = 0;
}

export class PrivatePayment extends Payment {
    @field({ decoder: Settlement, nullable: true })
    settlement: Settlement | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 153 })
    iban: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 153 })
    ibanName: string | null = null;

    @field({ decoder: IntegerDecoder, version: 197 })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    transferFee = 0;

    @field({ decoder: IntegerDecoder, optional: true })
    @field({ ...upgradePriceFrom2To4DecimalPlaces, optional: true })
    serviceFeePayout = 0;

    @field({ decoder: IntegerDecoder, optional: true })
    @field({ ...upgradePriceFrom2To4DecimalPlaces, optional: true })
    serviceFeeManual = 0;

    @field({ decoder: IntegerDecoder, optional: true })
    @field({ ...upgradePriceFrom2To4DecimalPlaces, optional: true })
    serviceFeeManualCharged = 0;
}
