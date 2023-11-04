import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, Decoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';

import { DNSRecord } from "./DNSRecord";
import { OrganizationEmail } from './OrganizationEmail';
import { PayconiqAccount, PrivatePaymentConfiguration } from './PaymentConfiguration';
import { PaymentMethod } from './PaymentMethod';
import { PaymentProvider } from './PaymentProvider';
import { PermissionRoleDetailed } from './Permissions';
import { StripeMetaData } from './StripeAccount';

export class CreditItem extends AutoEncoder {
    /**
     * Credits in cents
     */
    @field({ decoder: IntegerDecoder })
    change = 0

    /**
     * Credits in cents
     */
    @field({ decoder: DateDecoder })
    date: Date = new Date()

    /**
     * Credits in cents
     */
    @field({ decoder: StringDecoder })
    description: string

    /**
     * tmp fix
     */
    static patchIdentifier(): Decoder<string> {
        return StringDecoder
    }
}

export enum MollieStatus {
    NeedsData = "NeedsData",
    InReview = "InReview",
    Completed = "Completed"
}

export enum AcquisitionType {
    Recommended = "Recommended",
    Seen = "Seen",
    SocialMedia = "SocialMedia",
    Search = "Search",
    Other = "Other"
}

export enum MollieProfileMode {
    Test = "test",
    Live = "live"
}

export enum MollieProfileStatus {
    Unverified = "unverified",
    Verified = "verified",
    Blocked = "blocked"
}

export class MollieProfile extends AutoEncoder {
    @field({decoder: StringDecoder})
    id: string

    @field({decoder: new EnumDecoder(MollieProfileMode)})
    mode: MollieProfileMode

    @field({decoder: StringDecoder})
    name: string

    @field({decoder: StringDecoder})
    website: string

    @field({decoder: new EnumDecoder(MollieProfileStatus)})
    status: MollieProfileStatus
}

export class MollieOnboarding extends AutoEncoder  {
    @field({ decoder: BooleanDecoder })
    canReceivePayments = false

    @field({ decoder: BooleanDecoder })
    canReceiveSettlements = false

    @field({ decoder: new EnumDecoder(MollieStatus)})
    status: MollieStatus
}

export class BuckarooSettings extends AutoEncoder  {
    @field({ decoder: StringDecoder })
    key = ""

    @field({ decoder: StringDecoder })
    secret = ""

    @field({ decoder: new ArrayDecoder(new EnumDecoder(PaymentMethod)) })
    paymentMethods: PaymentMethod[] = [PaymentMethod.Bancontact, PaymentMethod.iDEAL, PaymentMethod.Payconiq]
}

export class OrganizationPrivateMetaData extends AutoEncoder {
    /**
     * @deprecated
     */
    @field({ decoder: StringDecoder, version: 149, nullable: true })
    privateKey: string | null = null

    /**
     * DNS records that need to be set in order to activate mail domain and registration domain
     */
    @field({ decoder: new ArrayDecoder(DNSRecord), version: 6 })
    dnsRecords: DNSRecord[] = [];

    /**
     * Register domain that is awaiting validation
     */
    @field({ decoder: StringDecoder, nullable: true, version: 84 })
    pendingRegisterDomain: string | null = null

    /**
     * Mail domain that is awaiting validation
     */
    @field({ decoder: StringDecoder, nullable: true, version: 6 })
    pendingMailDomain: string | null = null

    /**
     * The mail from domain that should be used (if validated).
     * This domain should have the SPF record and MX records needed to handle bounces
     */
    @field({ decoder: StringDecoder, nullable: true, version: 84 })
    mailFromDomain: string | null = null

    /**
     * Mail domain that is used to send e-mails. You can't set this directly, the server will set this value as soon as the domain has been validated.
     */
    @field({ decoder: StringDecoder, nullable: true, version: 6 })
    mailDomain: string | null = null

    @field({ decoder: BooleanDecoder, version: 8 })
    mailDomainActive = false

    /**
     * E-mail addresses that an organization can send from (or reply-to)
     */
    @field({ decoder: new ArrayDecoder(OrganizationEmail), version: 9 })
    emails: OrganizationEmail[] = [];

    /**
     * @deprecated
     * Credits in cents
     */
    @field({ decoder: new ArrayDecoder(CreditItem), version: 23, optional: true })
    credits: CreditItem[] = []

    // readonly
    @field({ decoder: MollieOnboarding, nullable: true, version: 27})
    mollieOnboarding: MollieOnboarding | null = null

    @field({ decoder: MollieProfile, nullable: true, version: 200})
    mollieProfile: MollieProfile|null = null

    /**
     * When set, Buckaroo has priority over Mollie as a payment provider
     */
    @field({ decoder: BuckarooSettings, nullable: true, version: 152 })
    buckarooSettings: BuckarooSettings | null = null

    @field({ decoder: PrivatePaymentConfiguration, version: 176, field: 'registrationProviderConfiguration' })
    @field({ decoder: PrivatePaymentConfiguration, version: 204 })
    registrationPaymentConfiguration = PrivatePaymentConfiguration.create({})

    /**
     * @deprecated
     */
    get registrationProviderConfiguration() {
        return this.registrationPaymentConfiguration
    }

    @field({ decoder: new ArrayDecoder(StringDecoder), version: 161})
    featureFlags: string[] = []

    /**
     * Null = use environment default
     */
    @field({ decoder: BooleanDecoder, nullable: true, version: 154 })
    useTestPayments: null | boolean = null

    // Only set for admins
    @field({ decoder: StringDecoder, nullable: true, version: 29, field: 'payconiqApiKey' })
    @field({ 
        decoder: new ArrayDecoder(PayconiqAccount), 
        version: 206,
        upgrade: (oldValue: string | null) => {
            if (oldValue === null) {
                return []
            }
            return [PayconiqAccount.create({ apiKey: oldValue })]
        }
    })
    payconiqAccounts: PayconiqAccount[] = []

    get payconiqApiKey(): string | null {
        if (this.payconiqAccounts.length === 0) {
            return null
        }
        return this.payconiqAccounts[0].apiKey
    }

    @field({ decoder: new ArrayDecoder(new EnumDecoder(AcquisitionType)), version: 56 })
    acquisitionTypes: AcquisitionType[] = [];

    @field({ decoder: new ArrayDecoder(PermissionRoleDetailed), version: 60 })
    roles: PermissionRoleDetailed[] = []

    @field({ decoder: StringDecoder, nullable: true, version: 88 })
    billingContact: string | null = null

    /**
     * @deprecated
     * Moved to public meta data. Do not use.
     */
    @field({ decoder: StringDecoder, nullable: true, version: 86 })
    VATNumber: string | null = null

    getPaymentProviderFor(method: PaymentMethod, stripeAccountMeta?: StripeMetaData | null): PaymentProvider | null  {
        if (method === PaymentMethod.Unknown || method === PaymentMethod.Transfer || method === PaymentMethod.PointOfSale) {
            return null
        }

        if (this.payconiqApiKey && method === PaymentMethod.Payconiq) {
            return PaymentProvider.Payconiq
        }

        if (stripeAccountMeta) {
            if (stripeAccountMeta.paymentMethods.includes(method)) {
                return PaymentProvider.Stripe
            }
        }

        // Is Buckaroo setup?
        if (this.buckarooSettings !== null) {
            if (this.buckarooSettings.paymentMethods.includes(method)) {
                return PaymentProvider.Buckaroo
            }
        }

        if ((this.mollieOnboarding && (this.mollieOnboarding?.canReceivePayments || this.useTestPayments)) && (method == PaymentMethod.Bancontact || method == PaymentMethod.iDEAL || method == PaymentMethod.CreditCard)) {
            return PaymentProvider.Mollie
        }

        return null
    }
}
