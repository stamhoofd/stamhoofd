import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';

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
import { downgradePaymentMethodArrayV150, PaymentMethod, PaymentMethodV150 } from './PaymentMethod';
import { UmbrellaOrganization } from './UmbrellaOrganization';
import { TransferSettings } from './webshops/TransferSettings';

export class OrganizationPackages extends AutoEncoder {
    @field({ decoder: new MapDecoder(new EnumDecoder(STPackageType), STPackageStatus) })
    packages = new Map<STPackageType, STPackageStatus>()

    isActive(type: STPackageType) {
        const status = this.packages.get(type)
        if (!status) {
            return false
        }
        if (!status.isActive) {
            return false
        }
        return true
    }
    
    get useMembers() {
        return this.isActive(STPackageType.Members) || this.isActive(STPackageType.LegacyMembers) || this.isActive(STPackageType.TrialMembers)
    }

    set useMembers(_: boolean) {
        console.warn("Deprected set on useMembers")
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
    type: OrganizationType;

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

    get modules() {
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
     * Logo used in a horizontal environment (e.g. menu bar)
     */
    @field({ decoder: Image, nullable: true, version: 11 })
    horizontalLogo: Image | null = null

    /**
     * Set either file or url for the privacy policy. If both are set, the url has priority
     */
    @field({ decoder: File, nullable: true, version: 25 })
    privacyPolicyFile: File | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 25 })
    privacyPolicyUrl: string | null = null

    /**
     * Logo to display (small)
     */
    @field({ decoder: Image, nullable: true, version: 11 })
    squareLogo: Image | null = null

    @field({ decoder: BooleanDecoder, optional: true })
    expandLogo = false

    @field({ decoder: StringDecoder, nullable: true, version: 21 })
    color: string | null = null

    // Everything below should move to registrations meta data

    @field({ decoder: IntegerDecoder })
    expectedMemberCount = 0

    @field({ decoder: new EnumDecoder(OrganizationGenderType) })
    genderType: OrganizationGenderType = OrganizationGenderType.Mixed

    @field({ decoder: DateDecoder })
    defaultStartDate: Date

    @field({ decoder: DateDecoder })
    defaultEndDate: Date

    @field({ decoder: new ArrayDecoder(GroupPrices) })
    defaultPrices: GroupPrices[] = []

    @field({ decoder: StringDecoder, version: 6, upgrade: () => "", field: "iban" })
    @field({ 
        decoder: TransferSettings, 
        version: 50, 
        upgrade: (iban: string) => {
            return TransferSettings.create({
                iban: iban ? iban : null
            })
        },
        downgrade: (transferSettings: TransferSettings) => {
            return transferSettings.iban ?? ""
        }
    })
    transferSettings = TransferSettings.create({})

    @field({ decoder: new ArrayDecoder(new EnumDecoder(PaymentMethodV150)), version: 26 })
    @field({ 
        decoder: new ArrayDecoder(new EnumDecoder(PaymentMethod)), 
        version: 151, 
        downgrade: downgradePaymentMethodArrayV150
    })
    paymentMethods: PaymentMethod[] = [PaymentMethod.Transfer]

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
            })
        ]
    }
}
