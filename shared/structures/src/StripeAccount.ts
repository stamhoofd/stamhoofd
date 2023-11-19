import { AnyDecoder, ArrayDecoder, AutoEncoder, BooleanDecoder, field, IntegerDecoder, RecordDecoder, StringDecoder } from "@simonbackx/simple-encoding";
import { Formatter } from "@stamhoofd/utility";

import { PaymentMethod, PaymentMethodHelper } from "./PaymentMethod";
import { TransferSettings } from "./webshops/TransferSettings";

/**
 * Should remain private
 */
export class PaymentProviderConfiguration extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true, version: 174 })
    stripeAccountId: string | null = null
}

export class Requirements extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(StringDecoder), optional: true })
    currently_due: string[] = []

    @field({ decoder: IntegerDecoder, optional: true, nullable: true })
    current_deadline: number | null = null

    @field({ decoder: StringDecoder, optional: true, nullable: true })
    disabled_reason: string | null = null
}

export class StripeBusinessProfile extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true})
    mcc: string | null = null

    @field({ decoder: StringDecoder })
    name = ""
}

export class StripeCompany extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder, nullable: true })
    structure: string | null = null
}

export class StripeMetaData extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true })
    type: 'express' | 'standard' = 'express'

    @field({ decoder: AnyDecoder, optional: true, nullable: true })
    blob: any | null = null

    @field({ decoder: StripeBusinessProfile, optional: true })
    business_profile = StripeBusinessProfile.create({})

    @field({ decoder: StringDecoder, optional: true, nullable: true })
    business_type: 'individual' | 'company' | 'non_profit' | 'government_entity' | null = null

    @field({ decoder: StripeCompany, optional: true, nullable: true })
    company: StripeCompany | null = null

    @field({ decoder: BooleanDecoder })
    charges_enabled = false

    @field({ decoder: BooleanDecoder })
    payouts_enabled = false

    @field({ decoder: BooleanDecoder, optional: true })
    details_submitted = false

    @field({ decoder: new RecordDecoder(StringDecoder, StringDecoder), optional: true })
    capabilities: Record<string, 'active' | 'pending' | 'inactive'> = {}

    @field({ decoder: Requirements, optional: true })
    requirements = Requirements.create({})

    @field({ decoder: Requirements, optional: true })
    future_requirements = Requirements.create({})

    @field({ decoder: StringDecoder, optional: true })
    bank_account_last4 = ""

    @field({ decoder: StringDecoder, optional: true })
    bank_account_bank_name = ""

    get paymentMethods(): PaymentMethod[] {
        if (!this.charges_enabled) {
            return []
        }
        const methods: PaymentMethod[] = []
        if (this.capabilities.card_payments === 'active') {
            methods.push(PaymentMethod.CreditCard)
        }

        if (this.capabilities.bancontact_payments === 'active') {
            methods.push(PaymentMethod.Bancontact)
        }

        if (this.capabilities.ideal_payments === 'active') {
            methods.push(PaymentMethod.iDEAL)
        }

        return methods;
    }
}

export class StripeAccount extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string

    @field({ decoder: StringDecoder })
    accountId: string

    @field({ decoder: StripeMetaData })
    meta: StripeMetaData

    get warning() {
        if (this.meta.requirements.current_deadline) {
            return "Je moet nieuwe documenten in orde brengen om te voorkomen dat uitbetalingen en betalingen worden stopgezet. Dit moet gebeuren voor "+ Formatter.date(new Date(this.meta.requirements.current_deadline * 1000)) + ". Ga naar je Stripe dashboard om dit in orde te brengen.";
        }
        if (this.meta.charges_enabled && this.meta.paymentMethods.length < 3) {
            const missing = [PaymentMethod.CreditCard, PaymentMethod.Bancontact, PaymentMethod.iDEAL].filter(m => !this.meta.paymentMethods.includes(m))
            const text = Formatter.joinLast(missing.map(m => PaymentMethodHelper.getName(m)), ", ", " en ");

            if (missing.length === 1) {
                return "De betaalmethode " + text + " werd nog niet door Stripe geactiveerd. Kijk na of alle informatie in je Stripe dashboard volledig ingevuld werd. Kijk vooral of het websiteadres correct is en of elke bestuurder een adres heeft ingevuld.";
            }
            return "De betaalmethodes " + text + " werden nog niet door Stripe geactiveerd. Kijk na of alle informatie in je Stripe dashboard volledig ingevuld werd. Kijk vooral of het websiteadres correct is en of elke bestuurder een adres heeft ingevuld.";
        }
    }
}