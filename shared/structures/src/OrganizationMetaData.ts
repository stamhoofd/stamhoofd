import { ArrayDecoder,AutoEncoder, BooleanDecoder, DateDecoder,EnumDecoder, field, IntegerDecoder, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';

import { Address } from './addresses/Address';
import { STPackageStatus, STPackageType } from './billing/STPackage';
import { File } from './files/File';
import { Image } from './files/Image';
import { GroupCategory } from './GroupCategory';
import { GroupPrices } from './GroupPrices';
import { Record } from './members/Record';
import { RecordType } from './members/RecordType';
import { OrganizationGenderType } from './OrganizationGenderType';
import { OrganizationType } from './OrganizationType';
import { PaymentMethod } from './PaymentMethod';
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

export enum AskRequirement {
    NotAsked = "NotAsked",
    Optional = "Optional",
    Required = "Required"
}

export class FreeContributionSettings extends AutoEncoder {
    @field({ decoder: StringDecoder })
    description = ""

    @field({ decoder: new ArrayDecoder(IntegerDecoder) })
    amounts: number[] = [500, 1500, 3000]
}

export class OrganizationRecordsConfiguration extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(StringDecoder) })
    @field({ decoder: new ArrayDecoder(new EnumDecoder(RecordType)), upgrade: () => [], version: 55 })
    enabledRecords: RecordType[] = []

    @field({ decoder: FreeContributionSettings, nullable: true, version: 92 })
    freeContribution: FreeContributionSettings | null = null

    /**
     * true: required
     * false: don't ask
     * null: optional
     */
    @field({ decoder: new EnumDecoder(AskRequirement), optional: true })
    doctor = AskRequirement.NotAsked

    /**
     * true: required
     * false: don't ask
     * null: optional
     */
    @field({ decoder: new EnumDecoder(AskRequirement), optional: true })
    emergencyContact = AskRequirement.Optional

    /**
     * Return true if at least one from the records should get asked
     */
    shouldAsk(...types: RecordType[]): boolean {
        for (const type of types) {
            if (this.enabledRecords.find(r => r === type)) {
                return true
            }

            if (type == RecordType.DataPermissions) {
                // Required if at least non oprivacy related record automatically
                if (this.needsData()) {
                    return true
                }
            }
        }
        return false
    }

    filterRecords(records: Record[], ...allow: RecordType[]): Record[] {
        return records.filter((r) => {
            if (allow.includes(r.type)) {
                return true
            }
            return this.shouldAsk(r.type)
        })
    }

    /**
     * Return true if we need to ask permissions for data, even when RecordType.DataPermissions is missing from enabledRecords
     */
    needsData(): boolean {
        if (this.doctor !== AskRequirement.NotAsked) {
            return true
        }
        if (this.enabledRecords.length == 0) {
            return false
        }

        if (this.enabledRecords.find(type => {
            if (![RecordType.DataPermissions, RecordType.MedicinePermissions, RecordType.PicturePermissions, RecordType.GroupPicturePermissions].includes(type)) {
                return true
            }
            return false
        })) {
            return true
        }
        return false
    }

    shouldSkipRecords(age: number | null): boolean {
        if (this.doctor !== AskRequirement.NotAsked) {
            return false
        }
        if (this.enabledRecords.length == 0) {
            return true
        }

        if (this.enabledRecords.length == 1 && (age === null || age >= 18)) {
            // Skip if the only record that should get asked is permission for medication
            return this.enabledRecords[0] === RecordType.MedicinePermissions
        }

        return false
    }

    /**
     * This fixes how inverted and special records are returned.
     * E.g. MedicalPermissions is returned if the member did NOT give permissions -> because we need to show a message
     * PicturePermissions is returned if no group picture permissions was given and normal picture permissions are disabled
     */
    filterForDisplay(records: Record[], age: number | null): Record[] {
        return this.filterRecords(
            Record.invertRecords(records), 
            ...(this.shouldAsk(RecordType.GroupPicturePermissions) ? [RecordType.PicturePermissions] : [])
        ).filter((record) => {
            // Some edge cases
            // Note: inverted types are already reverted here! -> GroupPicturePermissions means no permissions here
            
            if (record.type === RecordType.GroupPicturePermissions) {
                // When both group and normal pictures are allowed, hide the group pictures message
                if (this.shouldAsk(RecordType.PicturePermissions) && records.find(r => r.type === RecordType.PicturePermissions)) {
                    // Permissions for pictures -> this is okay
                    return false
                }

                if (!this.shouldAsk(RecordType.PicturePermissions)) {
                    // This is not a special case
                    return false
                }
            }

            // If no permissions for pictures but permissions for group pictures, only show the group message
            if (record.type === RecordType.PicturePermissions) {
                if (this.shouldAsk(RecordType.GroupPicturePermissions) && records.find(r => r.type === RecordType.GroupPicturePermissions)) {
                    // Only show the 'only permissions for group pictures' banner
                    return false
                }
            }


            // Member is older than 18 years, and no permissions for medicines
            if (record.type === RecordType.MedicinePermissions && (age ?? 18) >= 18) {
                return false
            }

            return true
        })
    }

    static getDefaultFor(type: OrganizationType): OrganizationRecordsConfiguration {
        if (type === OrganizationType.Youth) {
            // Enable all
            const records = Object.values(RecordType)

            return OrganizationRecordsConfiguration.create({
                enabledRecords: records,
                doctor: AskRequirement.Required,
                emergencyContact: AskRequirement.Optional
            })
        }

        if ([OrganizationType.Student ,OrganizationType.Sport, OrganizationType.Athletics, OrganizationType.Football, OrganizationType.Hockey, OrganizationType.Tennis, OrganizationType.Volleyball, OrganizationType.Swimming, OrganizationType.HorseRiding, OrganizationType.Basketball, OrganizationType.Dance, OrganizationType.Cycling, OrganizationType.Judo].includes(type)) {
            // Enable sport related records + pictures

            return OrganizationRecordsConfiguration.create({
                enabledRecords: [
                    RecordType.DataPermissions,
                    RecordType.PicturePermissions,

                    // Allergies
                    RecordType.FoodAllergies,
                    RecordType.MedicineAllergies,
                    RecordType.OtherAllergies,

                    // Health
                    RecordType.Asthma,
                    RecordType.Epilepsy,
                    RecordType.HeartDisease,
                    RecordType.Diabetes,
                    RecordType.SpecialHealthCare,
                    RecordType.Medicines,
                    RecordType.Rheumatism,
                    ...(type === OrganizationType.Swimming ? [RecordType.SkinCondition] : [RecordType.HayFever]),

                    RecordType.MedicinePermissions,

                    // Other
                    RecordType.Other,
                ],
                doctor: AskRequirement.Optional,
                emergencyContact: AskRequirement.Optional
            })
        }

         if (type === OrganizationType.LGBTQ) {
            // Request data permissions + emergency contact is optional
            return OrganizationRecordsConfiguration.create({
                enabledRecords: [RecordType.DataPermissions],
                doctor: AskRequirement.NotAsked,
                emergencyContact: AskRequirement.Optional
            })
        }

        // Others are all disabled by default
        return OrganizationRecordsConfiguration.create({})
    }
}


export class OrganizationMetaData extends AutoEncoder {
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

    @field({ decoder: new ArrayDecoder(new EnumDecoder(PaymentMethod)), version: 26 })
    paymentMethods: PaymentMethod[] = [PaymentMethod.Transfer]

    @field({ 
        decoder: OrganizationRecordsConfiguration, 
        version: 53, 
        upgrade: function(this: OrganizationMetaData) {
            return OrganizationRecordsConfiguration.getDefaultFor(OrganizationType.Youth)
        },
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
}
