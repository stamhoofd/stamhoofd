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
    @field({ decoder: StringDecoder, nullable: true })
    name: string | null = null;

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
            return $t(`6d107d78-0bd2-4236-9b59-faf8c0a34ae4`);
        }

        if (key.match(/(representative|person|individual|director)\.address/)) {
            return $t(`20cb6ab8-4e85-49c1-af2b-72464cbd417f`);
        }

        if (key.match(/(representative|person|individual|director)\.phone/)) {
            return $t(`075405d4-9e40-4e02-81e5-c72d06f12a56`);
        }

        if (key.match(/(representative|person|individual|director)\.email/)) {
            return $t(`28ac3c54-726d-472c-9c08-07324e597852`);
        }

        if (key.match(/(representative|person|individual|director)\.dob/)) {
            return $t(`567a8b1e-4404-4d82-b510-5c9036459a19`);
        }

        if (key.match(/(representative|person|individual|director)\.(first|last)_name/)) {
            return $t(`a7bad049-4c8c-4bfe-892b-daca0f7d1cb1`);
        }

        if (key.match(/(representative|person|individual|director)?\.relationship.title/)) {
            return $t(`e50edeb1-0376-4175-8e23-6b1409ba095d`);
        }

        if (key.match(/person_.+?\.address/)) {
            return $t(`5845f5e2-b1fe-4453-9e55-b46ebcd76191`);
        }

        if (key.match(/person_.+?\.phone/)) {
            return $t(`8df88274-3aa9-4f94-b512-e25838b1570a`);
        }

        if (key.match(/person_.+?\.email/)) {
            return $t(`c2cb273d-a5c2-4661-955b-3fceaf9b55eb`);
        }

        if (key.match(/person_.+?\.dob/)) {
            return $t(`54f1115a-1f70-4a72-8f1d-80f7fae7ed47`);
        }

        if (key.match(/person_.+?\.(first|last)_name/)) {
            return $t(`9cd80335-ce5a-4df2-ad9c-b0d9bff447c4`);
        }

        if (key.match(/person_.+?\.relationship.title/)) {
            return $t(`c742ce2a-17cf-4ae3-bb7d-632eab24da35`);
        }

        if (key.match(/(representative|person|individual|director)_/)) {
            return $t(`db96efa0-c48d-4812-a775-be42c9b0804e`);
        }

        if (key.match(/company_.+?\.address/)) {
            return $t(`e43ca9ec-8495-48af-a6df-8327e6f33d85`);
        }

        if (key === 'company.phone') {
            return $t(`f7821d11-0b71-4503-a8cb-18b2036611f1`);
        }

        if (key === 'company.name') {
            return $t(`0b4ece85-60f0-46b8-a6fc-09eb605b4138`);
        }

        if (key === 'company.verification.document') {
            return $t(`da498f50-0d40-4c68-a87c-488bd555e752`);
        }

        if (key === 'individual.verification.document') {
            return $t(`95983eff-3e46-4fc1-8a75-01bae935080c`);
        }

        if (key === 'business_profile.product_description') {
            return $t(`6ade2adb-91c3-4aa4-95d4-fd4550ec98f4`);
        }

        if (key === 'business_profile.url') {
            return $t(`6e7658ac-437e-4e1e-9efd-03c0a5cbd5d9`);
        }

        return $t(`b6185496-deab-4569-906f-c636e625bcd1`);
    });
    missing = Formatter.uniqueArray(missing);
    return Formatter.joinLast(missing, ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ');
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
                text: $t(`5c72f531-e4d7-4df3-8699-266ae2990ad9`, { date: Formatter.date(new Date(this.meta.requirements.current_deadline * 1000)) }) + ' ' + missing + '.',
                type: 'error',
            };
        }

        if (this.meta.charges_enabled && this.meta.paymentMethods.length < 3) {
            const missing = [PaymentMethod.CreditCard, PaymentMethod.Bancontact, PaymentMethod.iDEAL].filter(m => !this.meta.paymentMethods.includes(m));
            const text = Formatter.joinLast(missing.map(m => PaymentMethodHelper.getName(m)), ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ');
            const missingText = this.missingData;

            if (missing.length === 1) {
                return {
                    text: $t(`746b3a9d-2062-40d5-a355-e7854c331cf2`, { method: text }) + ' ' + (missingText ? (' ' + $t(`Volgende zaken zouden ontbreken:`) + ' ' + missingText + '.') : ''),
                    type: 'error',
                };
            }
            return {
                text: $t(`08b4f877-40eb-4363-932b-a56a853eaf30`, { methods: text }) + ' ' + (missingText ? (' ' + $t(`Volgende zaken zouden ontbreken:`) + ' ' + missingText + '.') : ''),
                type: 'error',
            };
        }

        if (this.meta.future_requirements.current_deadline) {
            const missing = this.missingData;
            const d = new Date(this.meta.future_requirements.current_deadline * 1000);
            return {
                text: $t(`5c72f531-e4d7-4df3-8699-266ae2990ad9`, { date: Formatter.date(d) }) + ' ' + missing + '.',
                // Error if needed within one month
                type: d < new Date(Date.now() + 24 * 60 * 60 * 1000 * 30) ? 'error' : 'warning',
            };
        }

        if (this.meta.details_submitted && (this.meta.requirements.currently_due.length || this.meta.requirements.eventually_due.length || this.meta.future_requirements.currently_due.length || this.meta.future_requirements.eventually_due.length)) {
            // Try to convert to readable text
            const missing = this.missingData;
            return {
                text: $t(`0c827ab2-42af-4b19-9160-a69475039314`) + ' ' + missing + '.',
                type: 'warning',
            };
        }
    }
}
