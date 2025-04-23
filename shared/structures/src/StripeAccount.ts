import { AnyDecoder, ArrayDecoder, AutoEncoder, BooleanDecoder, field, IntegerDecoder, RecordDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';

import { PaymentMethod, PaymentMethodHelper } from './PaymentMethod.js';

export class Requirements extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(StringDecoder), optional: true })
    currently_due: string[] = [];

    @field({ decoder: new ArrayDecoder(StringDecoder), optional: true })
    eventually_due: string[] = [];

    @field({ decoder: new ArrayDecoder(StringDecoder), optional: true })
    past_due: string[] = [];

    @field({ decoder: IntegerDecoder, optional: true, nullable: true })
    current_deadline: number | null = null;

    @field({ decoder: StringDecoder, optional: true, nullable: true })
    disabled_reason: string | null = null;
}

export class StripeBusinessProfile extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    mcc: string | null = null;

    @field({ decoder: StringDecoder })
    name = '';
}

export class StripeCompany extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder, nullable: true })
    structure: string | null = null;
}

export class StripeMetaAccountDashboardSettings extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true, nullable: true })
    display_name: string | null = '';
}

export class StripeMetaAccountSettings extends AutoEncoder {
    @field({ decoder: StripeMetaAccountDashboardSettings, optional: true })
    dashboard = StripeMetaAccountDashboardSettings.create({});
}

export class StripeMetaData extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true })
    type: 'express' | 'standard' = 'express';

    @field({ decoder: AnyDecoder, optional: true, nullable: true })
    blob: any = null;

    @field({ decoder: StripeBusinessProfile, optional: true })
    business_profile = StripeBusinessProfile.create({});

    @field({ decoder: StringDecoder, optional: true, nullable: true })
    business_type: 'individual' | 'company' | 'non_profit' | 'government_entity' | null = null;

    @field({ decoder: StripeCompany, optional: true, nullable: true })
    company: StripeCompany | null = null;

    @field({ decoder: BooleanDecoder })
    charges_enabled = false;

    @field({ decoder: BooleanDecoder })
    payouts_enabled = false;

    @field({ decoder: BooleanDecoder, optional: true })
    details_submitted = false;

    @field({ decoder: new RecordDecoder(StringDecoder, StringDecoder), optional: true })
    capabilities: Record<string, 'active' | 'pending' | 'inactive'> = {};

    @field({ decoder: Requirements, optional: true })
    requirements = Requirements.create({});

    @field({ decoder: StripeMetaAccountSettings, optional: true })
    settings = StripeMetaAccountSettings.create({});

    @field({ decoder: Requirements, optional: true })
    future_requirements = Requirements.create({});

    @field({ decoder: StringDecoder, optional: true })
    bank_account_last4 = '';

    @field({ decoder: StringDecoder, optional: true })
    bank_account_bank_name = '';

    @field({ decoder: StringDecoder, optional: true })
    bank_account_name = '';

    get paymentMethods(): PaymentMethod[] {
        if (!this.charges_enabled) {
            return [];
        }
        const methods: PaymentMethod[] = [];
        if (this.capabilities.card_payments === 'active') {
            methods.push(PaymentMethod.CreditCard);
        }

        if (this.capabilities.bancontact_payments === 'active') {
            methods.push(PaymentMethod.Bancontact);
        }

        if (this.capabilities.ideal_payments === 'active') {
            methods.push(PaymentMethod.iDEAL);
        }

        if (this.capabilities.sepa_debit_payments === 'active') {
            methods.push(PaymentMethod.DirectDebit);
        }

        return methods;
    }
}

function requirementsToString(list: string[]) {
    let missing = list.map((key) => {
        if (key.match(/person_.+?\.verification.document/)) {
            return $t(`identiteitsbewijs van een persoon`);
        }

        if (key.match(/(representative|person|individual|director)\.address/)) {
            return $t(`adres van een vertegenwoordiger`);
        }

        if (key.match(/(representative|person|individual|director)\.phone/)) {
            return $t(`telefoon van een vertegenwoordiger`);
        }

        if (key.match(/(representative|person|individual|director)\.email/)) {
            return $t(`email van een vertegenwoordiger`);
        }

        if (key.match(/(representative|person|individual|director)\.dob/)) {
            return $t(`geboortedatum van een vertegenwoordiger`);
        }

        if (key.match(/(representative|person|individual|director)\.(first|last)_name/)) {
            return $t(`naam van een vertegenwoordiger`);
        }

        if (key.match(/(representative|person|individual|director)?\.relationship.title/)) {
            return $t(`functie van een vertegenwoordiger`);
        }

        if (key.match(/person_.+?\.address/)) {
            return $t(`adres van een persoon`);
        }

        if (key.match(/person_.+?\.phone/)) {
            return $t(`telefoon van een persoon`);
        }

        if (key.match(/person_.+?\.email/)) {
            return $t(`email van een persoon`);
        }

        if (key.match(/person_.+?\.dob/)) {
            return $t(`geboortedatum van een persoon`);
        }

        if (key.match(/person_.+?\.(first|last)_name/)) {
            return $t(`naam van een persoon`);
        }

        if (key.match(/person_.+?\.relationship.title/)) {
            return $t(`functie van een persoon`);
        }

        if (key.match(/(representative|person|individual|director)_/)) {
            return $t(`gegevens van een persoon`);
        }

        if (key.match(/company_.+?\.address/)) {
            return $t(`adres van je vereniging`);
        }

        if (key === 'company.phone') {
            return $t(`telefoonnummer van je vereniging`);
        }

        if (key === 'company.name') {
            return $t(`naam van je vereniging`);
        }

        if (key === 'company.verification.document') {
            return $t(`verificatiedocument van je vereniging`);
        }

        if (key === 'individual.verification.document') {
            return $t(`verificatiedocument van natuurlijk persoon`);
        }

        if (key === 'business_profile.product_description') {
            return $t(`beschrijving van je vereniging`);
        }

        if (key === 'business_profile.url') {
            return $t(`website van je vereniging`);
        }

        return $t(`andere`);
    });
    missing = Formatter.uniqueArray(missing);
    return Formatter.joinLast(missing, ', ', ' ' + $t(`en`) + ' ');
}

export class StripeAccountPatch extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true, nullable: true })
    businessProfileUrl?: string | null = null;

    @field({ decoder: StringDecoder, optional: true, nullable: true })
    businessProfileName?: string | null = null;
}

export class StripeAccount extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    accountId: string;

    @field({ decoder: StripeMetaData })
    meta: StripeMetaData;

    get missingData() {
        return requirementsToString([...this.meta.requirements.past_due, ...this.meta.future_requirements.past_due, ...this.meta.requirements.currently_due, ...this.meta.requirements.eventually_due, ...this.meta.future_requirements.currently_due, ...this.meta.future_requirements.eventually_due]);
    }

    get canDelete() {
        return !this.meta.charges_enabled || !this.meta.payouts_enabled || !this.meta.details_submitted;
    }

    get warning(): { text: string; type: 'warning' | 'error' } | undefined {
        if (this.meta.requirements.current_deadline) {
            const missing = this.missingData;

            return {
                text: $t(`Je moet gegevens aanvullen om te voorkomen dat uitbetalingen en betalingen worden stopgezet. Dit moet gebeuren voor {date}. Ga naar je Stripe dashboard om dit in orde te brengen. Volgende zaken zouden ontbreken:`, { date: Formatter.date(new Date(this.meta.requirements.current_deadline * 1000)) }) + ' ' + missing + '.',
                type: 'error',
            };
        }

        if (this.meta.charges_enabled && this.meta.paymentMethods.length < 3) {
            const missing = [PaymentMethod.CreditCard, PaymentMethod.Bancontact, PaymentMethod.iDEAL].filter(m => !this.meta.paymentMethods.includes(m));
            const text = Formatter.joinLast(missing.map(m => PaymentMethodHelper.getName(m)), ', ', ' ' + $t(`en`) + ' ');
            const missingText = this.missingData;

            if (missing.length === 1) {
                return {
                    text: $t(`De betaalmethode {method} werd nog niet door Stripe geactiveerd. Kijk na of alle informatie in je Stripe dashboard volledig ingevuld werd.`, { method: text }) + ' ' + (missingText ? (' ' + $t(`Volgende zaken zouden ontbreken:`) + ' ' + missingText + '.') : ''),
                    type: 'error',
                };
            }
            return {
                text: $t(`De betaalmethodes {methods} werden nog niet door Stripe geactiveerd. Kijk na of alle informatie in je Stripe dashboard volledig ingevuld werd.`, { methods: text }) + ' ' + (missingText ? (' ' + $t(`Volgende zaken zouden ontbreken:`) + ' ' + missingText + '.') : ''),
                type: 'error',
            };
        }

        if (this.meta.future_requirements.current_deadline) {
            const missing = this.missingData;
            const d = new Date(this.meta.future_requirements.current_deadline * 1000);
            return {
                text: $t(`Je moet gegevens aanvullen om te voorkomen dat uitbetalingen en betalingen worden stopgezet. Dit moet gebeuren voor {date}. Ga naar je Stripe dashboard om dit in orde te brengen. Volgende zaken zouden ontbreken:`, { date: Formatter.date(d) }) + ' ' + missing + '.',
                // Error if needed within one month
                type: d < new Date(Date.now() + 24 * 60 * 60 * 1000 * 30) ? 'error' : 'warning',
            };
        }

        if (this.meta.details_submitted && (this.meta.requirements.currently_due.length || this.meta.requirements.eventually_due.length || this.meta.future_requirements.currently_due.length || this.meta.future_requirements.eventually_due.length)) {
            // Try to convert to readable text
            const missing = this.missingData;
            return {
                text: $t(`Niet alle gegevens van jouw vereniging werden in het Stripe dashboard ingevuld. Kijk na of alles werd ingevuld. Volgende zaken zouden ontbreken:`) + ' ' + missing + '.',
                type: 'warning',
            };
        }
    }
}
