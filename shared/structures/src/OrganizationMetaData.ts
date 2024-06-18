import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { Colors } from '@stamhoofd/utility';

import { Address } from './addresses/Address';
import { STPackageStatus, STPackageType } from './billing/STPackage';
import { Replacement } from './endpoints/EmailRequest';
import { File } from './files/File';
import { Image } from './files/Image';
import { GroupCategory } from './GroupCategory';
import { GroupPrices } from './GroupPrices';
import { OrganizationRecordsConfiguration } from './members/OrganizationRecordsConfiguration';
import { OrganizationGenderType } from './OrganizationGenderType';
import { OrganizationType } from './OrganizationType';
import { PaymentConfiguration } from './PaymentConfiguration';
import { PaymentMethod } from './PaymentMethod';
import { UmbrellaOrganization } from './UmbrellaOrganization';
import { TransferSettings } from './webshops/TransferSettings';
import { OrganizationTag } from './Platform';

export class OrganizationPackages extends AutoEncoder {
    @field({ decoder: new MapDecoder(new EnumDecoder(STPackageType), STPackageStatus) })
    packages = new Map<STPackageType, STPackageStatus>()

    isActive(type: STPackageType) {
        if (STAMHOOFD.userMode === 'platform') {
            return true;
        }
        
        const status = this.packages.get(type)
        if (!status) {
            return false
        }
        if (!status.isActive) {
            return false
        }
        return true
    }

    /**
     * Return amount of ms this package has been active for
     */
    getActiveTime(type: STPackageType): number|null {
        const status = this.packages.get(type)
        if (!status) {
            return null
        }
        if (!status.isActive) {
            return null
        }

        return Math.max(0, Date.now() - status.startDate.getTime())
    }

    wasActive(type: STPackageType) {
        const status = this.packages.get(type)
        if (!status) {
            return false
        }
        if (!status.wasActive) {
            return false
        }
        return true
    }

    /**
     * Return amount of ms this package has been active for
     */
    getDeactivatedTime(type: STPackageType): number|null {
        const status = this.packages.get(type)
        if (!status) {
            return null
        }
        if (!status.wasActive) {
            return null
        }

        const deactivateDate = status.deactivateDate;
        if (deactivateDate === null) {
            return null;
        }

        return Math.max(0, Date.now() - deactivateDate.getTime())
    }
    
    get useMembers() {
        return this.isActive(STPackageType.Members) || this.isActive(STPackageType.LegacyMembers) || this.isActive(STPackageType.TrialMembers)
    }

    set useMembers(_: boolean) {
        console.warn("Deprected set on useMembers")
    }

    get canStartMembersTrial() {
        return !this.useMembers && !this.wasActive(STPackageType.Members)
    }

    get isMembersTrial() {
        return !this.isActive(STPackageType.Members) && !this.isActive(STPackageType.LegacyMembers) && this.isActive(STPackageType.TrialMembers)
    }

    get isActivitiesTrial() {
        return !this.isActive(STPackageType.Members) && this.isActive(STPackageType.LegacyMembers) && this.isActive(STPackageType.TrialMembers)
    }

    get isWebshopsTrial() {
        return !this.isActive(STPackageType.Webshops) && !this.isActive(STPackageType.SingleWebshop) && this.isActive(STPackageType.TrialWebshops)
    }

    get canStartWebshopsTrial() {
        return !this.useWebshops && !this.wasActive(STPackageType.Webshops) && !this.wasActive(STPackageType.SingleWebshop)
    }

    get useWebshops() {
        return this.webshopLimit > 0
    }

    set useWebshops(_: boolean) {
        console.warn("Deprected set on useWebshops")
    }
    
    get webshopLimit() {
        if (this.isActive(STPackageType.Webshops)) {
            return 10
        }

        if (this.isActive(STPackageType.SingleWebshop)) {
            return 1
        }

        if (this.isActive(STPackageType.TrialWebshops)) {
            return 10
        }
        
        return 0
    }

    get disableActivities() {
        return !this.useActivities
    }

    get useActivities(): boolean {
        return this.isActive(STPackageType.Members) || this.isActive(STPackageType.TrialMembers)
    }

    get isPaid() {
        return this.isActive(STPackageType.Members) || this.isActive(STPackageType.LegacyMembers) || this.isActive(STPackageType.Webshops) || this.isActive(STPackageType.SingleWebshop)
    }

    get wasPaid() {
        return this.wasActive(STPackageType.Members) || this.wasActive(STPackageType.LegacyMembers) || this.wasActive(STPackageType.Webshops) || this.wasActive(STPackageType.SingleWebshop)
    }
}

/**
 * @deprecated
 */
export class OrganizationModules extends AutoEncoder {
    @field({ decoder: BooleanDecoder })
    useMembers = false

    @field({ decoder: BooleanDecoder })
    useWebshops = false

    /**
     * We use inverse property here because this can only be used in combination with useMembers == true
     */
    @field({ decoder: BooleanDecoder, version: 63 })
    disableActivities = false

    get useActivities(): boolean {
        return this.useMembers && !this.disableActivities
    }
}


export class OrganizationMetaData extends AutoEncoder {
    /**
     * Last time the organization signed the terms. Null means the creation date of the organization.
     */
    @field({ decoder: DateDecoder, nullable: true, version: 147 })
    lastSignedTerms: Date | null = null

    get didAcceptLatestTerms() {
        return this.lastSignedTerms !== null && this.lastSignedTerms >= new Date(2022, 0, 20, 0, 0, 0, 0)
    }

    get didAcceptEndToEndEncryptionRemoval() {
        return this.lastSignedTerms !== null && this.lastSignedTerms >= new Date(2022, 0, 20, 0, 0, 0, 0)
    }

    @field({ decoder: new EnumDecoder(OrganizationType) })
    type = OrganizationType.Other

    @field({ decoder: new ArrayDecoder(OrganizationTag), version: 260 })
    tags: OrganizationTag[] = []

    /**
     * Show beta features in this organization
     */
    @field({ decoder: BooleanDecoder, version: 108 })
    enableBetaFeatures = false

    /**
     * @deprecated Only used for migrations
     */
    @field({ decoder: OrganizationModules, version: 48, upgrade: () => OrganizationModules.create({ useMembers: true, useWebshops: true }), field: "modules" })
    modulesOld = OrganizationModules.create({})

    /**
     * @deprecated
     * Use packages
     */
    get modules(): OrganizationPackages {
        return this.packages
    }

    set modules(_: any) {
        console.error("Deprecated set on modules")
    }

    @field({ decoder: OrganizationPackages, version: 87 })
    packages = OrganizationPackages.create({})
    
    @field({ decoder: new EnumDecoder(UmbrellaOrganization), nullable: true })
    umbrellaOrganization: UmbrellaOrganization | null = null;

    /**
     * Set either file or url for the privacy policy. If both are set, the url has priority
     */
    @field({ decoder: File, nullable: true, version: 25 })
    privacyPolicyFile: File | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 25 })
    privacyPolicyUrl: string | null = null

    /**
     * Logo used in a horizontal environment (e.g. menu bar)
     */
    @field({ decoder: Image, nullable: true, version: 11 })
    horizontalLogo: Image | null = null

    /**
     * Logo to display (small)
     */
    @field({ decoder: Image, nullable: true, version: 11 })
    squareLogo: Image | null = null

    @field({ decoder: BooleanDecoder, optional: true })
    expandLogo = false

    @field({ decoder: Image, nullable: true, version: 185 })
    horizontalLogoDark: Image | null = null

    @field({ decoder: Image, nullable: true, version: 185 })
    squareLogoDark: Image | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 21 })
    color: string | null = null

    // Everything below should move to registrations meta data

    /**
     * @deprecated
     */
    @field({ decoder: IntegerDecoder, optional: true })
    expectedMemberCount = 0

    @field({ decoder: new EnumDecoder(OrganizationGenderType) })
    genderType: OrganizationGenderType = OrganizationGenderType.Mixed

    @field({ decoder: DateDecoder, optional: true })
    defaultStartDate: Date = new Date()

    @field({ decoder: DateDecoder, optional: true })
    defaultEndDate: Date = new Date()

    @field({ decoder: new ArrayDecoder(GroupPrices), optional: true })
    defaultPrices: GroupPrices[] = []

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
        downgrade: function() {
            return this.transferSettings
        }
    })
    oldTransferSettings = TransferSettings.create({})

    /**
     * @deprecated
     * Use registrationPaymentConfiguration.paymentMethods instead
     */
    @field({ 
        decoder: new ArrayDecoder(new EnumDecoder(PaymentMethod)), 
        version: 151, 
        field: 'paymentMethods',
        optional: true
    })
    @field({ 
        decoder: new ArrayDecoder(new EnumDecoder(PaymentMethod)), 
        version: 208, 
        field: 'oldPaymentMethods',
        optional: true, // We no longer expect this from the backend, so it can get removed in a future version
        downgrade: function() {
            // This return value for old clients
            return this.paymentMethods
        }
    })
    oldPaymentMethods: PaymentMethod[] = [PaymentMethod.Transfer]

    @field({ 
        decoder: PaymentConfiguration, 
        version: 204,
        upgrade: function () {
            return PaymentConfiguration.create({
                transferSettings: this.oldTransferSettings,
                paymentMethods: this.oldPaymentMethods
            })
        },
    })
    registrationPaymentConfiguration = PaymentConfiguration.create({paymentMethods: [PaymentMethod.Transfer]})

    /**
     * @deprecated
     * Use registrationPaymentConfiguration.paymentMethods instead
     */
    get paymentMethods(): PaymentMethod[] {
        return this.registrationPaymentConfiguration.paymentMethods
    }

    /**
     * @deprecated
     * Use registrationPaymentConfiguration.paymentMethods instead
     */
    get transferSettings(): TransferSettings {
        return this.registrationPaymentConfiguration.transferSettings
    }

    @field({ 
        decoder: OrganizationRecordsConfiguration, 
        version: 53,
        defaultValue: () => OrganizationRecordsConfiguration.create({})
    })
    recordsConfiguration: OrganizationRecordsConfiguration

    /**
     * Legal name of the organization (optional)
     */
    @field({ decoder: StringDecoder, nullable: true, version: 113 })
    companyName: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 113 })
    VATNumber: string | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 113 })
    companyNumber: string | null = null

    /**
     * Legal name of the organization (optional)
     */
    @field({ decoder: Address, nullable: true, version: 113 })
    companyAddress: Address | null = null;

    /**
     * All the available categories
     */
    @field({ 
        decoder: new ArrayDecoder(GroupCategory), 
        version: 57
    })
    categories: GroupCategory[] = [GroupCategory.create({ id: "root" })] // we use ID root here because this ID needs to stay the same since it won't be saved

    /**
     * We use one invisible root category to simplify the difference between non-root and root category
     */
    @field({ 
        decoder: StringDecoder, 
        version: 57
    })
    rootCategoryId = this.categories[0]?.id ?? ""

    /**
     * (todo) Contains the fully build hierarchy without the need for ID lookups. Try not to use this tree when modifying it.
     */
    get rootCategory(): GroupCategory | undefined {
        return this.categories.find(c => c.id === this.rootCategoryId)
    }

    getEmailReplacements() {
        return [
            Replacement.create({
                token: "primaryColor",
                value: this.color ? this.color : "#0053ff"
            }),
            Replacement.create({
                token: "primaryColorContrast",
                value: this.color ? Colors.getContrastColor(this.color) : "#fff"
            }),
        ]
    }
}
