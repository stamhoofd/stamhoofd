import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, Decoder, EnumDecoder, field, IntegerDecoder, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';

import { Premise } from './addresses/Premise.js';
import { DNSRecord } from './DNSRecord.js';
import { StamhoofdFilterDecoder } from './filters/FilteredRequest.js';
import { FilterWrapperMarker, unwrapFilter } from './filters/StamhoofdFilter.js';
import { MemberResponsibility } from './MemberResponsibility.js';
import { RecordAnswer, RecordAnswerDecoder } from './members/records/RecordAnswer.js';
import { OrganizationEmail } from './OrganizationEmail.js';
import { PayconiqAccount, PrivatePaymentConfiguration } from './PaymentConfiguration.js';
import { PaymentMethod } from './PaymentMethod.js';
import { PaymentProvider } from './PaymentProvider.js';
import { PermissionRoleDetailed, PermissionRoleForResponsibility } from './PermissionRole.js';
import { StripeMetaData } from './StripeAccount.js';

export class CreditItem extends AutoEncoder {
    /**
     * Credits in cents
     */
    @field({ decoder: IntegerDecoder })
    change = 0;

    /**
     * Credits in cents
     */
    @field({ decoder: DateDecoder })
    date: Date = new Date();

    /**
     * Credits in cents
     */
    @field({ decoder: StringDecoder })
    description: string;

    /**
     * tmp fix
     */
    static patchIdentifier(): Decoder<string> {
        return StringDecoder;
    }
}

export enum MollieStatus {
    NeedsData = 'NeedsData',
    InReview = 'InReview',
    Completed = 'Completed',
}

export enum AcquisitionType {
    Recommended = 'Recommended',
    Seen = 'Seen',
    SocialMedia = 'SocialMedia',
    Search = 'Search',
    Other = 'Other',
}

export enum MollieProfileMode {
    Test = 'test',
    Live = 'live',
}

export enum MollieProfileStatus {
    Unverified = 'unverified',
    Verified = 'verified',
    Blocked = 'blocked',
}

export class MollieProfile extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: new EnumDecoder(MollieProfileMode) })
    mode: MollieProfileMode;

    @field({ decoder: StringDecoder })
    name: string;

    @field({ decoder: StringDecoder })
    website: string;

    @field({ decoder: new EnumDecoder(MollieProfileStatus) })
    status: MollieProfileStatus;
}

export class MollieOnboarding extends AutoEncoder {
    @field({ decoder: BooleanDecoder })
    canReceivePayments = false;

    @field({ decoder: BooleanDecoder })
    canReceiveSettlements = false;

    @field({ decoder: new EnumDecoder(MollieStatus) })
    status: MollieStatus;
}

export class BuckarooSettings extends AutoEncoder {
    @field({ decoder: StringDecoder })
    key = '';

    @field({ decoder: StringDecoder })
    secret = '';

    @field({ decoder: new ArrayDecoder(new EnumDecoder(PaymentMethod)) })
    paymentMethods: PaymentMethod[] = [PaymentMethod.Bancontact, PaymentMethod.iDEAL, PaymentMethod.Payconiq];
}

export class BalanceNotificationSettings extends AutoEncoder {
    @field({ decoder: BooleanDecoder })
    @field({ decoder: BooleanDecoder, version: 363, upgrade: () => (false) }) // Force reset to false
    enabled = false;

    @field({ decoder: StringDecoder, nullable: true })
    emailId: string | null = null;

    @field({ decoder: IntegerDecoder, version: 355 })
    maximumReminderEmails = 3;

    /**
     * Minimum days between emails
     */
    @field({ decoder: IntegerDecoder, version: 355 })
    minimumDaysBetween = 5;

    /**
     * Which contacts to use for balances from other organizations
     */
    @field({ decoder: StamhoofdFilterDecoder, version: 363, nullable: true })
    organizationContactsFilter = {};

    getOrganizationContactsFilterResponsibilityIds(): string[] {
        const f = this.organizationContactsFilter ?? {};
        const unwrapped = unwrapFilter(f, {
            meta: {
                responsibilityIds: {
                    $in: FilterWrapperMarker,
                },
            },
        });
        if (Array.isArray(unwrapped.markerValue) && unwrapped.markerValue.length && unwrapped.markerValue.every(v => typeof v === 'string')) {
            return unwrapped.markerValue;
        }
        return [];
    }
}

export class OrganizationPrivateMetaData extends AutoEncoder {
    /**
     * @deprecated
     */
    @field({ decoder: StringDecoder, version: 149, nullable: true, optional: true })
    privateKey: string | null = null;

    /**
     * DNS records that need to be set in order to activate mail domain and registration domain
     */
    @field({ decoder: new ArrayDecoder(DNSRecord), version: 6 })
    dnsRecords: DNSRecord[] = [];

    /**
     * Register domain that is awaiting validation
     */
    @field({ decoder: StringDecoder, nullable: true, version: 84 })
    pendingRegisterDomain: string | null = null;

    /**
     * Mail domain that is awaiting validation
     */
    @field({ decoder: StringDecoder, nullable: true, version: 6 })
    pendingMailDomain: string | null = null;

    /**
     * The mail from domain that should be used (if validated).
     * This domain should have the SPF record and MX records needed to handle bounces
     */
    @field({ decoder: StringDecoder, nullable: true, version: 84 })
    mailFromDomain: string | null = null;

    /**
     * Mail domain that is used to send e-mails. You can't set this directly, the server will set this value as soon as the domain has been validated.
     */
    @field({ decoder: StringDecoder, nullable: true, version: 6 })
    mailDomain: string | null = null;

    @field({ decoder: BooleanDecoder, version: 8 })
    mailDomainActive = false;

    /**
     * E-mail addresses that an organization can send from (or reply-to)
     */
    @field({ decoder: new ArrayDecoder(OrganizationEmail), version: 9 })
    emails: OrganizationEmail[] = [];

    /**
     * Balance reminder email settings
     */
    @field({ decoder: BalanceNotificationSettings, version: 355 })
    balanceNotificationSettings = BalanceNotificationSettings.create({});

    /**
     * @deprecated
     * Credits in cents
     */
    @field({ decoder: new ArrayDecoder(CreditItem), version: 23, optional: true })
    credits: CreditItem[] = [];

    // readonly
    @field({ decoder: MollieOnboarding, nullable: true, version: 27 })
    mollieOnboarding: MollieOnboarding | null = null;

    @field({ decoder: MollieProfile, nullable: true, version: 200 })
    mollieProfile: MollieProfile | null = null;

    /**
     * When set, Buckaroo has priority over Mollie as a payment provider
     */
    @field({ decoder: BuckarooSettings, nullable: true, version: 152 })
    buckarooSettings: BuckarooSettings | null = null;

    @field({ decoder: PrivatePaymentConfiguration, version: 176, field: 'registrationProviderConfiguration' })
    @field({ decoder: PrivatePaymentConfiguration, version: 204 })
    registrationPaymentConfiguration = PrivatePaymentConfiguration.create({});

    /**
     * @deprecated
     */
    get registrationProviderConfiguration() {
        return this.registrationPaymentConfiguration;
    }

    @field({ decoder: new ArrayDecoder(StringDecoder), version: 161 })
    featureFlags: string[] = [];

    /**
     * Null = use environment default
     */
    @field({ decoder: BooleanDecoder, nullable: true, version: 154 })
    useTestPayments: null | boolean = null;

    // Only set for admins
    @field({ decoder: StringDecoder, nullable: true, version: 29, field: 'payconiqApiKey' })
    @field({
        decoder: new ArrayDecoder(PayconiqAccount),
        version: 206,
        upgrade: (oldValue: string | null) => {
            if (oldValue === null) {
                return [];
            }
            return [PayconiqAccount.create({ apiKey: oldValue })];
        },
        downgrade: (newValue: PayconiqAccount[]) => {
            if (newValue.length === 0) {
                return null;
            }
            return newValue[0].apiKey;
        },
    })
    payconiqAccounts: PayconiqAccount[] = [];

    get payconiqApiKey(): string | null {
        if (this.payconiqAccounts.length === 0) {
            return null;
        }
        return this.payconiqAccounts[0].apiKey;
    }

    @field({ decoder: new ArrayDecoder(new EnumDecoder(AcquisitionType)), version: 56 })
    acquisitionTypes: AcquisitionType[] = [];

    @field({ decoder: new ArrayDecoder(PermissionRoleDetailed), version: 60 })
    roles: PermissionRoleDetailed[] = [];

    @field({ decoder: new ArrayDecoder(MemberResponsibility), version: 280 })
    responsibilities: MemberResponsibility[] = [];

    /**
     * Link responsibility type ids to roles that should be auto-applied for users linked to members with those responsibilities
     */
    @field({ decoder: new ArrayDecoder(PermissionRoleForResponsibility), version: 280 })
    inheritedResponsibilityRoles: PermissionRoleForResponsibility[] = [];

    @field({ decoder: StringDecoder, nullable: true, version: 88 })
    billingContact: string | null = null;

    /**
     * @deprecated
     * Moved to public meta data. Do not use.
     */
    @field({ decoder: StringDecoder, nullable: true, version: 86, optional: true })
    VATNumber: string | null = null;

    @field({ decoder: new ArrayDecoder(Premise), version: 319 })
    premises: Premise[] = [];

    @field({
        decoder: new MapDecoder(StringDecoder, RecordAnswerDecoder),
        version: 358,
    })
    recordAnswers: Map<string, RecordAnswer> = new Map();

    get actualTestPayments(): boolean {
        if (this.useTestPayments !== null) {
            return this.useTestPayments;
        }

        return STAMHOOFD.environment !== 'production';
    }

    getPaymentProviderFor(method: PaymentMethod, stripeAccountMeta?: StripeMetaData | null): PaymentProvider | null {
        if (method === PaymentMethod.Unknown || method === PaymentMethod.Transfer || method === PaymentMethod.PointOfSale) {
            return null;
        }

        if (this.payconiqApiKey && method === PaymentMethod.Payconiq) {
            return PaymentProvider.Payconiq;
        }

        if (stripeAccountMeta) {
            if (stripeAccountMeta.paymentMethods.includes(method)) {
                return PaymentProvider.Stripe;
            }
        }

        // Is Buckaroo setup?
        if (this.buckarooSettings !== null) {
            if (this.buckarooSettings.paymentMethods.includes(method)) {
                return PaymentProvider.Buckaroo;
            }
        }

        if ((this.mollieOnboarding && (this.mollieOnboarding?.canReceivePayments || this.actualTestPayments)) && (method == PaymentMethod.Bancontact || method == PaymentMethod.iDEAL || method == PaymentMethod.CreditCard)) {
            return PaymentProvider.Mollie;
        }

        return null;
    }
}
