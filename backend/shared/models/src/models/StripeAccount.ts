/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { column, Model } from '@simonbackx/simple-database';
import { Requirements, StripeBusinessProfile, StripeCompany, StripeMetaAccountSettings, StripeMetaData } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

/**
 * Keeps track of how much a member/user owes or needs to be reimbursed.
 */
export class StripeAccount extends Model {
    static table = "stripe_accounts"

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    organizationId: string

    @column({ type: "string" })
    accountId: string

    @column({ type: "json", decoder: StripeMetaData })
    meta = StripeMetaData.create({})

    @column({ type: "string" })
    status: 'active' | 'deleted' = 'active'

    @column({
        type: "datetime", beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date()
            date.setMilliseconds(0)
            return date
        }
    })
    createdAt: Date

    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        },
        skipUpdate: true
    })
    updatedAt: Date

    setMetaFromStripeAccount(account: any) {
        this.meta = StripeMetaData.create({
            type: account.type ?? 'express',
            blob: account,
            business_profile: StripeBusinessProfile.create(!account.business_profile?.name ? {...account.business_profile, name: ''} : account.business_profile),
            business_type: account.business_type ?? this.meta.business_type ?? null,
            company: account.company ? StripeCompany.create(account.company) : (this.meta.company ?? null),
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            details_submitted: account.details_submitted,
            capabilities: account.capabilities,
            requirements: Requirements.create(account.requirements),
            future_requirements: Requirements.create(account.future_requirements),
            settings: StripeMetaAccountSettings.create(account.settings),
            bank_account_last4: account.external_accounts?.data[0]?.last4 ?? this.meta.bank_account_last4 ?? "",
            bank_account_bank_name: account.external_accounts?.data[0]?.bank_name ?? this.meta.bank_account_bank_name ?? "",
        });
    }
}
