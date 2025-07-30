import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { Colors } from '@stamhoofd/utility';

import { Address } from './addresses/Address.js';
import { STPackageStatus, STPackageType } from './billing/STPackage.js';
import { Company } from './Company.js';
import { Replacement } from './endpoints/EmailRequest.js';
import { File } from './files/File.js';
import { Image } from './files/Image.js';
import { GroupCategory } from './GroupCategory.js';
import { OrganizationRecordsConfiguration } from './members/OrganizationRecordsConfiguration.js';
import { OldGroupPrices } from './OldGroupPrices.js';
import { OrganizationGenderType } from './OrganizationGenderType.js';
import { OrganizationPrivateMetaData } from './OrganizationPrivateMetaData.js';
import { OrganizationType } from './OrganizationType.js';
import { PaymentConfiguration } from './PaymentConfiguration.js';
import { PaymentMethod } from './PaymentMethod.js';
import { UmbrellaOrganization } from './UmbrellaOrganization.js';
import { TransferSettings } from './webshops/TransferSettings.js';
import { UitpasClientCredentialsStatus } from './UitpasClientCredentialsStatus.js';

export class OrganizationPackages extends AutoEncoder {
    @field({ decoder: new MapDecoder(new EnumDecoder(STPackageType), STPackageStatus) })
    packages = new Map<STPackageType, STPackageStatus>();

    isActive(type: STPackageType) {
        if (STAMHOOFD.userMode === 'platform') {
            return true;
        }

        const status = this.packages.get(type);
        if (!status) {
            return false;
        }
        if (!status.isActive) {
            return false;
        }
        return true;
    }

    /**
     * Return amount of ms this package has been active for
     */
    getActiveTime(type: STPackageType): number | null {
        const status = this.packages.get(type);
        if (!status) {
            return null;
        }
        if (!status.isActive) {
            return null;
        }

        return Math.max(0, Date.now() - status.startDate.getTime());
    }

    wasActive(type: STPackageType) {
        const status = this.packages.get(type);
        if (!status) {
            return false;
        }
        if (!status.wasActive) {
            return false;
        }
        return true;
    }

    /**
     * Return amount of ms this package has been active for
     */
    getDeactivatedTime(type: STPackageType): number | null {
        const status = this.packages.get(type);
        if (!status) {
            return null;
        }
        if (!status.wasActive) {
            return null;
        }

        const deactivateDate = status.deactivateDate;
        if (deactivateDate === null) {
            return null;
        }

        return Math.max(0, Date.now() - deactivateDate.getTime());
    }

    get useMembers() {
        return this.isActive(STPackageType.Members) || this.isActive(STPackageType.LegacyMembers) || this.isActive(STPackageType.TrialMembers);
    }

    set useMembers(_: boolean) {
        console.warn('Deprected set on useMembers');
    }

    get canStartMembersTrial() {
        return !this.useMembers && !this.wasActive(STPackageType.Members);
    }

    get isMembersTrial() {
        return !this.isActive(STPackageType.Members) && !this.isActive(STPackageType.LegacyMembers) && this.isActive(STPackageType.TrialMembers);
    }

    get isActivitiesTrial() {
        return !this.isActive(STPackageType.Members) && this.isActive(STPackageType.LegacyMembers) && this.isActive(STPackageType.TrialMembers);
    }

    get isWebshopsTrial() {
        return !this.isActive(STPackageType.Webshops) && !this.isActive(STPackageType.SingleWebshop) && this.isActive(STPackageType.TrialWebshops);
    }

    get canStartWebshopsTrial() {
        return !this.useWebshops && !this.wasActive(STPackageType.Webshops) && !this.wasActive(STPackageType.SingleWebshop);
    }

    get useWebshops() {
        return this.webshopLimit > 0;
    }

    set useWebshops(_: boolean) {
        console.warn('Deprected set on useWebshops');
    }

    get webshopLimit() {
        if (this.isActive(STPackageType.Webshops)) {
            return 10;
        }

        if (this.isActive(STPackageType.SingleWebshop)) {
            return 1;
        }

        if (this.isActive(STPackageType.TrialWebshops)) {
            return 10;
        }

        return 0;
    }

    get disableActivities() {
        return !this.useActivities;
    }

    get useActivities(): boolean {
        return this.isActive(STPackageType.Members) || this.isActive(STPackageType.TrialMembers);
    }

    get isPaid() {
        return this.isActive(STPackageType.Members) || this.isActive(STPackageType.LegacyMembers) || this.isActive(STPackageType.Webshops) || this.isActive(STPackageType.SingleWebshop);
    }

    get wasPaid() {
        return this.wasActive(STPackageType.Members) || this.wasActive(STPackageType.LegacyMembers) || this.wasActive(STPackageType.Webshops) || this.wasActive(STPackageType.SingleWebshop);
    }
}

/**
 * @deprecated
 */
export class OrganizationModules extends AutoEncoder {
    @field({ decoder: BooleanDecoder })
    useMembers = false;

    @field({ decoder: BooleanDecoder })
    useWebshops = false;

    /**
     * We use inverse property here because this can only be used in combination with useMembers == true
     */
    @field({ decoder: BooleanDecoder, version: 63 })
    disableActivities = false;

    get useActivities(): boolean {
        return this.useMembers && !this.disableActivities;
    }
}

export class OrganizationMetaData extends AutoEncoder {
    /**
     * Last time the organization signed the terms. Null means the creation date of the organization.
     */
    @field({ decoder: DateDecoder, nullable: true, version: 147 })
    lastSignedTerms: Date | null = null;

    get didAcceptLatestTerms() {
        return this.lastSignedTerms !== null && this.lastSignedTerms >= new Date(2022, 0, 20, 0, 0, 0, 0);
    }

    get didAcceptEndToEndEncryptionRemoval() {
        return this.lastSignedTerms !== null && this.lastSignedTerms >= new Date(2022, 0, 20, 0, 0, 0, 0);
    }

    @field({ decoder: new EnumDecoder(OrganizationType) })
    type = OrganizationType.Other;

    /**
     * Contains the ids of the tags
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), version: 260 })
    tags: string[] = [];

    /**
     * Show beta features in this organization
     */
    @field({ decoder: BooleanDecoder, version: 108 })
    enableBetaFeatures = false;

    /**
     * @deprecated Only used for migrations
     */
    @field({ decoder: OrganizationModules, version: 48, upgrade: () => OrganizationModules.create({ useMembers: true, useWebshops: true }), field: 'modules' })
    modulesOld = OrganizationModules.create({});

    /**
     * @deprecated
     * Use packages
     */
    get modules(): OrganizationPackages {
        return this.packages;
    }

    set modules(_: any) {
        console.error('Deprecated set on modules');
    }

    @field({ decoder: OrganizationPackages, version: 87 })
    packages = OrganizationPackages.create({});

    @field({ decoder: new EnumDecoder(UmbrellaOrganization), nullable: true })
    umbrellaOrganization: UmbrellaOrganization | null = null;

    /**
     * Set either file or url for the privacy policy. If both are set, the url has priority
     */
    @field({ decoder: File, nullable: true, version: 25 })
    privacyPolicyFile: File | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 25 })
    privacyPolicyUrl: string | null = null;

    /**
     * Logo used in a horizontal environment (e.g. menu bar)
     */
    @field({ decoder: Image, nullable: true, version: 11 })
    horizontalLogo: Image | null = null;

    /**
     * Logo to display (small)
     */
    @field({ decoder: Image, nullable: true, version: 11 })
    squareLogo: Image | null = null;

    @field({ decoder: BooleanDecoder, optional: true })
    expandLogo = false;

    @field({ decoder: Image, nullable: true, version: 185 })
    horizontalLogoDark: Image | null = null;

    @field({ decoder: Image, nullable: true, version: 185 })
    squareLogoDark: Image | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 21 })
    color: string | null = null;

    // Everything below should move to registrations meta data

    /**
     * @deprecated
     */
    @field({ decoder: IntegerDecoder, optional: true })
    expectedMemberCount = 0;

    /**
     * @deprecated
     */
    @field({ decoder: new EnumDecoder(OrganizationGenderType), optional: true })
    genderType: OrganizationGenderType = OrganizationGenderType.Mixed;

    /**
     * @deprecated
     */
    @field({ decoder: DateDecoder, optional: true })
    defaultStartDate: Date = new Date();

    /**
     * @deprecated
     */
    @field({ decoder: DateDecoder, optional: true })
    defaultEndDate: Date = new Date();

    /**
     * @deprecated
     */
    @field({ decoder: new ArrayDecoder(OldGroupPrices), optional: true })
    defaultPrices: OldGroupPrices[] = [];

    /**
     * @deprecated
     * Use registrationPaymentConfiguration.transferSettings instead
     */
    @field({
        decoder: TransferSettings,
        version: 50,
        field: 'transferSettings',
        optional: true, // We no longer expect this from the backend, so it can get removed in a future version
    })
    @field({
        decoder: TransferSettings,
        version: 208,
        field: 'oldTransferSettings',
        optional: true, // We no longer expect this from the backend, so it can get removed in a future version
        downgrade: function () {
            return this.transferSettings;
        },
    })
    oldTransferSettings = TransferSettings.create({});

    /**
     * @deprecated
     * Use registrationPaymentConfiguration.paymentMethods instead
     */
    @field({
        decoder: new ArrayDecoder(new EnumDecoder(PaymentMethod)),
        version: 151,
        field: 'paymentMethods',
        optional: true,
    })
    @field({
        decoder: new ArrayDecoder(new EnumDecoder(PaymentMethod)),
        version: 208,
        field: 'oldPaymentMethods',
        optional: true, // We no longer expect this from the backend, so it can get removed in a future version
        downgrade: function () {
            // This return value for old clients
            return this.paymentMethods;
        },
    })
    oldPaymentMethods: PaymentMethod[] = [PaymentMethod.Transfer];

    @field({
        decoder: PaymentConfiguration,
        version: 204,
        upgrade: function () {
            return PaymentConfiguration.create({
                transferSettings: this.oldTransferSettings,
                paymentMethods: this.oldPaymentMethods,
            });
        },
    })
    registrationPaymentConfiguration = PaymentConfiguration.create({ paymentMethods: [PaymentMethod.PointOfSale] });

    /**
     * @deprecated
     * Use registrationPaymentConfiguration.paymentMethods instead
     */
    get paymentMethods(): PaymentMethod[] {
        return this.registrationPaymentConfiguration.paymentMethods;
    }

    /**
     * @deprecated
     * Use registrationPaymentConfiguration.paymentMethods instead
     */
    get transferSettings(): TransferSettings {
        return this.registrationPaymentConfiguration.transferSettings;
    }

    @field({
        decoder: OrganizationRecordsConfiguration,
        version: 53,
        defaultValue: () => OrganizationRecordsConfiguration.create({}),
    })
    recordsConfiguration: OrganizationRecordsConfiguration;

    /**
     * @deprecated Moved to companies
     */
    @field({ decoder: StringDecoder, nullable: true, version: 113, field: 'companyName', optional: true })
    companyName: string | null = null;

    /**
     * @deprecated Moved to companies
     */
    @field({ decoder: StringDecoder, nullable: true, version: 113, field: 'VATNumber', optional: true })
    VATNumber: string | null = null;

    /**
     * @deprecated Moved to companies
     */
    @field({ decoder: StringDecoder, nullable: true, version: 113, field: 'companyNumber', optional: true })
    companyNumber: string | null = null;

    /**
     * @deprecated Moved to companies
     */
    @field({ decoder: Address, nullable: true, version: 113, field: 'companyAddress', optional: true })
    companyAddress: Address | null = null;

    @field({ decoder: new ArrayDecoder(Company), upgrade: function (this: OrganizationMetaData) {
        return (this.companyName || this.VATNumber || this.companyNumber || this.companyAddress)
            ? [
                    Company.create({
                        id: 'default', // required we have stable ids in upgrades
                        name: this.companyName ?? '',
                        VATNumber: this.VATNumber,
                        companyNumber: this.companyNumber,
                        address: this.companyAddress,
                    }),
                ]
            : [];
    }, version: 322 })
    companies: Company[] = [];

    /**
     * @deprecated
     * Use OrganizationRegistrationPeriod instead
     *
     * All the available categories
     */
    @field({
        decoder: new ArrayDecoder(GroupCategory),
        version: 57,
    })
    categories: GroupCategory[] = [GroupCategory.create({ id: 'root' })]; // we use ID root here because this ID needs to stay the same since it won't be saved

    /**
     * @deprecated
     * Use OrganizationRegistrationPeriod instead
     *
     * We use one invisible root category to simplify the difference between non-root and root category
     */
    @field({
        decoder: StringDecoder,
        version: 57,
    })
    rootCategoryId = this.categories[0]?.id ?? '';

    @field({ decoder: StringDecoder, version: 378, nullable: true })
    uitpasOrganizerId: string | null = null;

    @field({ decoder: StringDecoder, version: 378, nullable: true })
    uitpasOrganizerName: string | null = null;

    @field({ decoder: new EnumDecoder(UitpasClientCredentialsStatus), version: 378, defaultValue: () => UitpasClientCredentialsStatus.NotConfigured })
    uitpasClientCredentialsStatus: UitpasClientCredentialsStatus = UitpasClientCredentialsStatus.NotConfigured;

    /**
     * @deprecated
     * Use OrganizationRegistrationPeriod instead
     *
     * (todo) Contains the fully build hierarchy without the need for ID lookups. Try not to use this tree when modifying it.
     */
    get rootCategory(): GroupCategory | undefined {
        return this.categories.find(c => c.id === this.rootCategoryId);
    }

    getEmailReplacements(organization: { name: string; privateMeta: OrganizationPrivateMetaData | null }) {
        const base: Replacement[] = [
            Replacement.create({
                token: 'organizationName',
                value: organization.name,
            }),

        ];

        const fromAddress = organization.privateMeta?.emails?.find(e => e.default) || organization.privateMeta?.emails[0];

        if (fromAddress) {
            base.push(
                Replacement.create({
                    token: 'fromAddress',
                    value: fromAddress.email,
                }),
            );
            base.push(
                Replacement.create({
                    token: 'fromName',
                    value: fromAddress.name ?? organization.name,
                }),
            );
        }
        else {
            base.push(
                Replacement.create({
                    token: 'fromName',
                    value: organization.name,
                }),
            );
        }

        if (this.color) {
            base.push(
                Replacement.create({
                    token: 'primaryColor',
                    value: this.color ? this.color : '#0053ff',
                }),
                Replacement.create({
                    token: 'primaryColorContrast',
                    value: this.color ? Colors.getContrastColor(this.color) : '#fff',
                }),
            );
        }

        return base;
    }

    /**
     * True if at least one id matches
     */
    matchTags(ids: string[]) {
        for (const id of ids) {
            if (this.tags.includes(id)) {
                return true;
            }
        }
        return false;
    }
}
