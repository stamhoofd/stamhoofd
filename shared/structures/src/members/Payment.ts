import { AutoEncoder, DateDecoder,EnumDecoder,field, IntegerDecoder,StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";

import { downgradePaymentMethodV150, PaymentMethod, PaymentMethodHelper, PaymentMethodV150 } from '../PaymentMethod';
import { PaymentProvider } from '../PaymentProvider';
import { PaymentStatus } from '../PaymentStatus';
import { TransferSettings } from '../webshops/TransferSettings';

export class Payment extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    /// Last selected payment method. Nullable if none has been selected
    @field({ decoder: new EnumDecoder(PaymentMethodV150), nullable: true })
    @field({ 
        decoder: new EnumDecoder(PaymentMethod), 
        version: 151, 
        downgrade: downgradePaymentMethodV150
    })
    method: PaymentMethod | null = null

    @field({ decoder: new EnumDecoder(PaymentStatus) })
    status: PaymentStatus = PaymentStatus.Created

    @field({ decoder: new EnumDecoder(PaymentProvider), nullable: true, version: 152 })
    provider: PaymentProvider | null = null

    @field({ decoder: IntegerDecoder })
    price: number

    @field({ decoder: IntegerDecoder, nullable: true, version: 92 })
    freeContribution: number | null = null

    // Transfer description if paid via transfer
    @field({ decoder: StringDecoder, nullable: true })
    transferDescription: string | null = null

    @field({ decoder: TransferSettings, nullable: true, version: 160 })
    transferSettings: TransferSettings | null = null

    @field({ decoder: DateDecoder, nullable: true })
    paidAt: Date | null = null

    @field({ decoder: DateDecoder })
    createdAt: Date

    @field({ decoder: DateDecoder })
    updatedAt: Date

    matchQuery(query: string): boolean {
        const lowerQuery = query.toLowerCase();
        if (
            this.transferDescription && this.transferDescription.toLowerCase().includes(lowerQuery)
        ) {
            return true;
        }
        return false;
    }

    getHTMLTable(): string {
        let str = `<table width="100%" cellspacing="0" cellpadding="0" class="email-data-table"><tbody>`


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
                title: "Betaalmethode",
                value: this.method ? Formatter.capitalizeFirstLetter(PaymentMethodHelper.getName(this.method)) : ""
            },
            {
                title: "Te betalen",
                value: this.status !== PaymentStatus.Succeeded ? Formatter.price(this?.price ?? 0) : Formatter.price(0)
            },
            ...(
                this.method === PaymentMethod.Transfer ? [
                    {
                        title: "Mededeling",
                        value: this.transferDescription ?? ""
                    },
                    {
                        title: "Rekeningnummer",
                        value: this.transferSettings?.iban ?? ""
                    },
                    {
                        title: "Begunstigde",
                        value: this.transferSettings?.creditor ?? ""
                    }
                ] 
                : []
            )
            
        ]

        for (const replacement of data) {
            if (replacement.value.length == 0) {
                continue;
            }
            str += `<tr><td><h4>${Formatter.escapeHtml(replacement.title)}</h4></td><td>${Formatter.escapeHtml(replacement.value)}</td></tr>`
        }

        return str+"</tbody></table>";
    }
}

export class Settlement extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string

    @field({ decoder: StringDecoder })
    reference: string

    @field({ decoder: DateDecoder })
    settledAt: Date

    @field({ decoder: IntegerDecoder })
    amount: number
}

export class PrivatePayment extends Payment {
    @field({ decoder: Settlement, nullable: true })
    settlement: Settlement | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 153 })
    iban: string | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 153 })
    ibanName: string | null = null
}

