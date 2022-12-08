import { ArrayDecoder, AutoEncoder, Decoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding"

import { ChoicesFilterChoice, ChoicesFilterDefinition, ChoicesFilterMode } from "../filters/ChoicesFilter"
import { FilterDefinition } from "../filters/FilterDefinition"
import { NumberFilterDefinition } from "../filters/NumberFilter"
import { PropertyFilter } from "../filters/PropertyFilter"
import { RegistrationsFilterChoice, RegistrationsFilterDefinition } from "../filters/RegistrationsFilter"
import { StringFilterDefinition } from "../filters/StringFilter"
import { Group } from "../Group"
import { Organization } from "../Organization"
import { RegisterItem } from "./checkout/RegisterItem"
import { Gender } from "./Gender"
import { MemberDetails } from "./MemberDetails"
import { MemberWithRegistrations } from "./MemberWithRegistrations"
import { LegacyRecordType } from "./records/LegacyRecordType"
import { RecordCheckboxAnswer, RecordChooseOneAnswer, RecordMultipleChoiceAnswer, RecordTextAnswer } from "./records/RecordAnswer"
import { RecordCategory } from "./records/RecordCategory"
import { RecordSettings, RecordType } from "./records/RecordSettings"

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

/**
 * Convenicence class used to pass around details and current or future groups it is registered in
 * -> needed for filtering.
 */
export class MemberDetailsWithGroups {
    details: MemberDetails
    member?: MemberWithRegistrations
    registerItems: RegisterItem[] = []

    constructor(details: MemberDetails, member?: MemberWithRegistrations, registerItems: RegisterItem[] = []) {
        this.details = details
        this.member = member
        this.registerItems = registerItems
    }

    static getBaseFilterDefinitions(): FilterDefinition<MemberDetailsWithGroups>[] {
        return [
            // TODO: map member filters instead of redefining them
            new NumberFilterDefinition<MemberDetailsWithGroups>({
                id: "member_age", 
                name: "Leeftijd", 
                getValue: (member) => {
                    return member.details.age ?? 99
                },
                floatingPoint: false
            }),
            new ChoicesFilterDefinition<MemberDetailsWithGroups>({
                id: "member_gender", 
                name: "Geslacht", 
                choices: [
                    new ChoicesFilterChoice(Gender.Male, "Man"),
                    new ChoicesFilterChoice(Gender.Female, "Vrouw"),
                    new ChoicesFilterChoice(Gender.Other, "Andere"),
                ], 
                getValue: (member) => {
                    return [member.details.gender]
                },
                defaultMode: ChoicesFilterMode.Or
            }),
            new RegistrationsFilterDefinition<MemberDetailsWithGroups>({
                id: "registrations", 
                name: "Inschrijvingen",
                getValue: (member) => {
                    const groups = member.member?.groups.map(g => RegistrationsFilterChoice.create({
                        id: g.id,
                        name: g.settings.name,
                        waitingList: false
                    })) ?? []

                    const waitingGroups = member.member?.waitingGroups.map(g => RegistrationsFilterChoice.create({
                        id: g.id,
                        name: g.settings.name,
                        waitingList: true
                    })) ?? []

                    const pendingGroups = member.registerItems.map(item => RegistrationsFilterChoice.create({
                        id: item.group.id,
                        name: item.group.settings.name,
                        waitingList: item.waitingList
                    })) ?? []

                    return [...groups, ...waitingGroups, ...pendingGroups]
                }
            }),
            new ChoicesFilterDefinition<MemberDetailsWithGroups>({
                id: "member_missing_data", 
                name: "Ontbrekende gegevens", 
                description: "Als één van de geselecteerde gegevens ontbreekt of niet is ingevuld. Op deze manier kan je handige combinaties vormen, bv. een noodcontactpersoon enkel vragen als er maar één ouder is.",
                choices: [
                    new ChoicesFilterChoice("birthDay", "Geboortedatum"),
                    new ChoicesFilterChoice("address", "Adres", "Van lid zelf"),
                    new ChoicesFilterChoice("phone", "Telefoonnummer", "Van lid zelf"),
                    new ChoicesFilterChoice("email", "E-mailadres", "Van lid zelf"),
                    new ChoicesFilterChoice("parents", "Ouders"),
                    new ChoicesFilterChoice("secondParent", "Tweede ouder", "Als er maar één ouder is toegevoegd aan een lid. Handig om te selecteren op een eenoudergezin, om zo een extra contactpersoon mogelijk te maken"),
                    new ChoicesFilterChoice("emergencyContact", "Noodcontact"),
                ], 
                explainFilter: (filter) => {
                    return "gegevens ontbreken ("+filter.choiceIds.map(id => filter.definition.choices.find(c => c.id === id)?.name ?? "?").join(", ")+")"
                },
                getValue: (member) => {
                    const missing: string[] = []
                    if (!member.details.birthDay) {
                        missing.push("birthDay")
                    }

                    if (!member.details.address) {
                        missing.push("address")
                    }

                    if (!member.details.phone) {
                        missing.push("phone")
                    }

                    if (!member.details.email) {
                        missing.push("email")
                    }

                    if (member.details.parents.length == 0) {
                        missing.push("parents")
                    }

                    if (member.details.parents.length == 1) {
                        missing.push("secondParent")
                    }

                    if (member.details.emergencyContacts.length == 0) {
                        missing.push("emergencyContact")
                    }
                    return missing
                },
                defaultMode: ChoicesFilterMode.Or
            }),
        ]
    }

    static getFilterDefinitions(organization: Organization, options: {groups?: Group[], member?: MemberWithRegistrations, registerItems?: RegisterItem[]}): FilterDefinition<MemberDetailsWithGroups>[] {
        // Make a list of all the groups
        const groups = options.groups ?? []
        groups.push(...options.member?.groups ?? [])
        groups.push(...options.member?.waitingGroups ?? [])
        groups.push(...options.registerItems?.map(i => i.group) ?? [])

        // Remove duplicates
        const uniqueGroups = groups.filter((group, index, self) => self.findIndex(g => g.id === group.id) === index)

        // Map groups to record categories that are relevant to them
        // TODO: we should move this from the organization settings to the group and category settings
        const recordCategories = organization.meta.recordsConfiguration.recordCategories
        
        return [
            ...this.getBaseFilterDefinitions(),
            ...RecordCategory.getRecordCategoryDefinitions(recordCategories, (member: MemberDetailsWithGroups) => {
                return member.details.recordAnswers
            }),
        ]
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
    emailAddress: PropertyFilter<MemberDetails> | null = null

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    phone: PropertyFilter<MemberDetails> | null = null

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    gender: PropertyFilter<MemberDetails> | null = null

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    birthDay: PropertyFilter<MemberDetails> | null = null

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    address: PropertyFilter<MemberDetails> | null = null

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    parents: PropertyFilter<MemberDetailsWithGroups> | null = null

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    emergencyContacts: PropertyFilter<MemberDetailsWithGroups> | null = null

    @field({ decoder: new ArrayDecoder(RecordCategory as Decoder<RecordCategory>), version: 117 })
    recordCategories: RecordCategory[] = []

    // General configurations
    @field({ decoder: FreeContributionSettings, nullable: true, version: 92 })
    freeContribution: FreeContributionSettings | null = null

    /**
     * @deprecated
     * Moved to recordCategories
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), field: "enabledRecords" })
    @field({ decoder: new ArrayDecoder(new EnumDecoder(LegacyRecordType)), upgrade: () => [], version: 55, field: "enabledRecords" })
    @field({ decoder: new ArrayDecoder(new EnumDecoder(LegacyRecordType)), version: 117, field: "enabledLegacyRecords" })
    enabledLegacyRecords: LegacyRecordType[] = []

    /**
     * @deprecated
     * true: required
     * false: don't ask
     * null: optional
     */
    @field({ decoder: new EnumDecoder(AskRequirement), optional: true })
    doctor = AskRequirement.NotAsked

    /**
     * @deprecated
     * true: required
     * false: don't ask
     * null: optional
     */
    @field({ decoder: new EnumDecoder(AskRequirement), optional: true })
    emergencyContact = AskRequirement.Optional
}