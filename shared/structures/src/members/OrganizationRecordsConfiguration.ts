import { ArrayDecoder, AutoEncoder, Decoder, EnumDecoder, field, IntegerDecoder, MapDecoder, StringDecoder } from "@simonbackx/simple-encoding"

import { PropertyFilter } from "../filters/PropertyFilter"
import { LegacyRecordType } from "./records/LegacyRecordType"
import { RecordCategory } from "./records/RecordCategory"

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

export class FinancialSupportSettings extends AutoEncoder {
    /**
     * E.g. 'financial support'
     */
    @field({ decoder: StringDecoder })
    title = FinancialSupportSettings.defaultTitle

    /**
     * E.g. 'We provide financial support for families in financial difficulties. You can ask for this by checking this checkbox'
     */
    @field({ decoder: StringDecoder })
    description = FinancialSupportSettings.defaultDescription

    /**
     * E.g. 'My family is in need of financial support'
     */
    @field({ decoder: StringDecoder })
    checkboxLabel = FinancialSupportSettings.defaultCheckboxLabel

    /**
     * E.g. 'SOMkort'
    */
    @field({ decoder: StringDecoder, version: 289 })
    priceName = FinancialSupportSettings.defaultPriceName

    /**
     * E.g. 'Uses financial support'
     */
    @field({ decoder: StringDecoder, optional: true })
    warningText = FinancialSupportSettings.defaultWarningText

    static get defaultDescription() {
        return "We doen ons best om de kostprijs van onze activiteiten zo laag mogelijk te houden. Daarnaast voorzien we middelen om gezinnen die dat nodig hebben te ondersteunen. Om de drempel zo laag mogelijk te houden, voorzien we een discrete checkbox waarmee je kan aangeven dat je ondersteuning nodig hebt. We gaan hier uiterst discreet mee om."
    }

    static get defaultTitle() {
        return "Financiële ondersteuning"
    }

    static get defaultPriceName() {
        return "Verlaagd tarief"
    }

    static get defaultCheckboxLabel() {
        return "Mijn gezin heeft nood aan financiële ondersteuning en ik wil dit discreet kenbaar maken"
    }

    static get defaultWarningText() {
        return "Gebruikt financiële ondersteuning"
    }
}

export class DataPermissionsSettings extends AutoEncoder {
    /**
     * E.g. 'financial support'
     */
    @field({ decoder: StringDecoder })
    title = DataPermissionsSettings.defaultTitle

    /**
     * E.g. 'We provide financial support for families in financial difficulties. You can ask for this by checking this checkbox'
     */
    @field({ decoder: StringDecoder })
    description = DataPermissionsSettings.defaultDescription

    /**
     * E.g. 'My family is in need of financial support'
     */
    @field({ decoder: StringDecoder })
    checkboxLabel = DataPermissionsSettings.defaultCheckboxLabel

    /**
     * E.g. 'Uses financial support'
     */
    @field({ decoder: StringDecoder, optional: true })
    warningText = DataPermissionsSettings.defaultWarningText

    static get defaultDescription() {
        return ""
    }

    static get defaultTitle() {
        return "Toestemming verzamelen gevoelige gegevens"
    }

    static get defaultCheckboxLabel() {
        return "Ik geef toestemming om gevoelige gegevens te verzamelen en te verwerken. Hoe we met deze gegevens omgaan staat vermeld in ons privacybeleid."
    }

    static get defaultWarningText() {
        return "Geen toestemming om gevoelige gegevens te verzamelen"
    }
}

export class OrganizationRecordsConfiguration extends AutoEncoder {
    // New record configurations

    /**
     * If the organizations provides support for families in financial difficulties
     */
    @field({ decoder: FinancialSupportSettings, nullable: true, version: 117 })
    financialSupport: FinancialSupportSettings | null = null

    /**
     * Ask permissions to collect data
     */
    @field({ decoder: DataPermissionsSettings, nullable: true, version: 117 })
    dataPermission: DataPermissionsSettings | null = null

    @field({ decoder: PropertyFilter, nullable: true, version: 124 })
    emailAddress: PropertyFilter | null = null

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    phone: PropertyFilter | null = null

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    gender: PropertyFilter | null = null

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    birthDay: PropertyFilter | null = null

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    address: PropertyFilter | null = null

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    parents: PropertyFilter | null = null

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    emergencyContacts: PropertyFilter | null = null

    @field({ decoder: new ArrayDecoder(RecordCategory as Decoder<RecordCategory>), version: 117 })
    recordCategories: RecordCategory[] = []

    /**
     * Defines if optional record categories in the parent are enabled, and when they are enabled (using a filter)
     */
    @field({ decoder: new MapDecoder(StringDecoder, PropertyFilter), version: 254 })
    inheritedRecordCategories: Map<string, PropertyFilter> = new Map()

    // General configurations
    @field({ decoder: FreeContributionSettings, nullable: true, version: 92 })
    freeContribution: FreeContributionSettings | null = null

    /**
     * Note: best to not use this visually
     */
    static mergeChild(parent: OrganizationRecordsConfiguration, child: OrganizationRecordsConfiguration): OrganizationRecordsConfiguration {
        const clone = child.clone();
        if (parent.financialSupport !== null) {
            clone.financialSupport = parent.financialSupport;
        }

        if (parent.dataPermission !== null) {
            clone.dataPermission = parent.dataPermission;
        }

        if (parent.emailAddress !== null) {
            clone.emailAddress = parent.emailAddress;
        }

        if (parent.phone !== null) {
            clone.phone = parent.phone;
        }

        if (parent.gender !== null) {
            clone.gender = parent.gender
        }

        if (parent.birthDay !== null) {
            clone.birthDay = parent.birthDay
        }

        if (parent.address !== null) {
            clone.address = parent.address
        }

        if (parent.parents !== null) {
            clone.parents = parent.parents
        }

        if (parent.emergencyContacts !== null) {
            clone.emergencyContacts = parent.emergencyContacts
        }

        if (parent.freeContribution !== null) {
            clone.freeContribution = parent.freeContribution
        }

        clone.recordCategories = [...parent.recordCategories.map(r => {
            const c = r.clone();
            if (r.defaultEnabled) {
                return c;
            }
            const inheritedFilter = child.inheritedRecordCategories.get(r.id);
            if (inheritedFilter !== undefined) {
                c.filter = inheritedFilter;
                c.defaultEnabled = true;
            }

            return c;
        }), ...clone.recordCategories]

        // Nothing inherited yet
        clone.inheritedRecordCategories = new Map()

        return clone;
    }
}
