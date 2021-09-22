import { ArrayDecoder, AutoEncoder, EnumDecoder,field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding"

import { OrganizationType } from "../OrganizationType"
import { LegacyRecord } from "./records/LegacyRecord"
import { LegacyRecordType } from "./records/LegacyRecordType"

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
    // New record configurations
    

    // Old configurations

    @field({ decoder: new ArrayDecoder(StringDecoder) })
    @field({ decoder: new ArrayDecoder(new EnumDecoder(LegacyRecordType)), upgrade: () => [], version: 55 })
    enabledRecords: LegacyRecordType[] = []

    // General configurations
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
    shouldAsk(...types: LegacyRecordType[]): boolean {
        for (const type of types) {
            if (this.enabledRecords.find(r => r === type)) {
                return true
            }

            if (type == LegacyRecordType.DataPermissions) {
                // Required if at least non oprivacy related record automatically
                if (this.needsData()) {
                    return true
                }
            }
        }
        return false
    }

    filterRecords(records: LegacyRecord[], ...allow: LegacyRecordType[]): LegacyRecord[] {
        return records.filter((r) => {
            if (allow.includes(r.type)) {
                return true
            }
            return this.shouldAsk(r.type)
        })
    }

    /**
     * Return true if we need to ask permissions for data, even when LegacyRecordType.DataPermissions is missing from enabledRecords
     */
    needsData(): boolean {
        if (this.doctor !== AskRequirement.NotAsked) {
            return true
        }
        if (this.enabledRecords.length == 0) {
            return false
        }

        if (this.enabledRecords.find(type => {
            if (![LegacyRecordType.DataPermissions, LegacyRecordType.MedicinePermissions, LegacyRecordType.PicturePermissions, LegacyRecordType.GroupPicturePermissions].includes(type)) {
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
            return this.enabledRecords[0] === LegacyRecordType.MedicinePermissions
        }

        return false
    }

    /**
     * This fixes how inverted and special records are returned.
     * E.g. MedicalPermissions is returned if the member did NOT give permissions -> because we need to show a message
     * PicturePermissions is returned if no group picture permissions was given and normal picture permissions are disabled
     */
    filterForDisplay(records: LegacyRecord[], age: number | null): LegacyRecord[] {
        return this.filterRecords(
            LegacyRecord.invertRecords(records), 
            ...(this.shouldAsk(LegacyRecordType.GroupPicturePermissions) ? [LegacyRecordType.PicturePermissions] : [])
        ).filter((record) => {
            // Some edge cases
            // Note: inverted types are already reverted here! -> GroupPicturePermissions means no permissions here
            
            if (record.type === LegacyRecordType.GroupPicturePermissions) {
                // When both group and normal pictures are allowed, hide the group pictures message
                if (this.shouldAsk(LegacyRecordType.PicturePermissions) && records.find(r => r.type === LegacyRecordType.PicturePermissions)) {
                    // Permissions for pictures -> this is okay
                    return false
                }

                if (!this.shouldAsk(LegacyRecordType.PicturePermissions)) {
                    // This is not a special case
                    return false
                }
            }

            // If no permissions for pictures but permissions for group pictures, only show the group message
            if (record.type === LegacyRecordType.PicturePermissions) {
                if (this.shouldAsk(LegacyRecordType.GroupPicturePermissions) && records.find(r => r.type === LegacyRecordType.GroupPicturePermissions)) {
                    // Only show the 'only permissions for group pictures' banner
                    return false
                }
            }


            // Member is older than 18 years, and no permissions for medicines
            if (record.type === LegacyRecordType.MedicinePermissions && (age ?? 18) >= 18) {
                return false
            }

            return true
        })
    }

    static getDefaultFor(type: OrganizationType): OrganizationRecordsConfiguration {
        if (type === OrganizationType.Youth) {
            // Enable all
            const records = Object.values(LegacyRecordType)

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
                    LegacyRecordType.DataPermissions,
                    LegacyRecordType.PicturePermissions,

                    // Allergies
                    LegacyRecordType.FoodAllergies,
                    LegacyRecordType.MedicineAllergies,
                    LegacyRecordType.OtherAllergies,

                    // Health
                    LegacyRecordType.Asthma,
                    LegacyRecordType.Epilepsy,
                    LegacyRecordType.HeartDisease,
                    LegacyRecordType.Diabetes,
                    LegacyRecordType.SpecialHealthCare,
                    LegacyRecordType.Medicines,
                    LegacyRecordType.Rheumatism,
                    ...(type === OrganizationType.Swimming ? [LegacyRecordType.SkinCondition] : [LegacyRecordType.HayFever]),

                    LegacyRecordType.MedicinePermissions,

                    // Other
                    LegacyRecordType.Other,
                ],
                doctor: AskRequirement.Optional,
                emergencyContact: AskRequirement.Optional
            })
        }

         if (type === OrganizationType.LGBTQ) {
            // Request data permissions + emergency contact is optional
            return OrganizationRecordsConfiguration.create({
                enabledRecords: [LegacyRecordType.DataPermissions],
                doctor: AskRequirement.NotAsked,
                emergencyContact: AskRequirement.Optional
            })
        }

        // Others are all disabled by default
        return OrganizationRecordsConfiguration.create({})
    }
}