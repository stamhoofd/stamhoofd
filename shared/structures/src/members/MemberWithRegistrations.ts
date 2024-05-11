import { ArrayDecoder, field } from '@simonbackx/simple-encoding';

import { ChoicesFilterChoice, ChoicesFilterDefinition, ChoicesFilterMode } from '../filters/ChoicesFilter';
import { DateFilterDefinition } from '../filters/DateFilter';
import { NumberFilterDefinition } from '../filters/NumberFilter';
import { RegistrationsFilterChoice, RegistrationsFilterDefinition } from '../filters/RegistrationsFilter';
import { StringFilterDefinition } from '../filters/StringFilter';
import { Group } from '../Group';
import { GroupCategory } from '../GroupCategory';
import { Organization } from '../Organization';
import { UmbrellaOrganization } from '../UmbrellaOrganization';
import { CanRegisterResponse, OldRegisterCartValidator } from './checkout/OldRegisterCartValidator';
import { OldIDRegisterItem, OldRegisterItem } from './checkout/OldRegisterItem';
import { Gender } from './Gender';
import { MemberWithRegistrationsBlob } from './MemberWithRegistrationsBlob';
import { MemberDetailsWithGroups } from './OrganizationRecordsConfiguration';
import { RecordType } from './records/RecordSettings';
import { Registration } from './Registration';

export class MemberWithRegistrations extends MemberWithRegistrationsBlob {
    // Calculated properties for convenience
    @field({ decoder: new ArrayDecoder(Registration), optional: true })
    activeRegistrations: Registration[] = []

    get inactiveRegistrations() {
        return this.registrations.filter(r => !!this.activeRegistrations.find(r2 => r2.id == r.id))
    }

    get isMinor() {
        return (this.details.age == null && !!this.groups.find(g => g.settings.maxAge !== null && g.settings.maxAge < 18)) || super.isMinor
    }

    /**
     * Groups the member is currently registered for
     */
    @field({ decoder: new ArrayDecoder(Group), optional: true })
    groups: Group[] = []

    /**
     * Groups the member is on the waiting list for (not accepted)
     */
    @field({ decoder: new ArrayDecoder(Group), optional: true})
    waitingGroups: Group[] = []

    /**
     * Groups the member is on the waiting list for and is accepted for
     */
    @field({ decoder: new ArrayDecoder(Group), optional: true})
    acceptedWaitingGroups: Group[] = []

    /**
     * All groups of this organization (used for finding information of groups)
     */
    @field({ decoder: new ArrayDecoder(Group), optional: true })
    allGroups: Group[] = []

    /**
     * Return true if this member was registered in the previous year (current doesn't count)
     */
    get isExistingMember(): boolean {
        return OldRegisterCartValidator.isExistingMember(this, this.allGroups)
    }

    static fromMember(member: MemberWithRegistrationsBlob, groups: Group[]) {
        const m = MemberWithRegistrations.create(member)
        m.fillGroups(groups)
        return m
    }

    filterRegistrations(filters: {groups?: Group[] | null, waitingList?: boolean, cycleOffset?: number, cycle?: number, canRegister?: boolean}) {
        return this.registrations.filter(r => {
            if (filters.groups && !filters.groups.find(g => g.id === r.groupId)) {
                return false
            }

            let cycle = filters.cycle
            if (filters.cycle === undefined) {
                const group = (filters.groups ?? this.allGroups).find(g => g.id === r.groupId)
                if (group) {
                    cycle = group.cycle - (filters.cycleOffset ?? 0)
                }
            }

            if (
                cycle !== undefined 
                && (filters.waitingList === undefined || r.waitingList === filters.waitingList) 
                && r.cycle === cycle
            ) {
                if (filters.canRegister !== undefined && r.waitingList) {
                    return r.canRegister === filters.canRegister
                }
                return true;
            }
            return false;
        })
    }

    /**
     * Pass all the groups of an organization to the member so we can fill in all the groups and registrations that are active
     */
    fillGroups(groups: Group[]) {
        this.activeRegistrations = []
        const groupMap = new Map<string, Group>()
        const waitlistGroups = new Map<string, Group>()
        const acceptedWaitlistGroups = new Map<string, Group>()

        for (const registration of this.registrations) {
            const group = groups.find(g => g.id == registration.groupId)

            if (group) {
                if (group.cycle == registration.cycle && registration.deactivatedAt === null && (registration.registeredAt !== null || registration.waitingList)) {
                    this.activeRegistrations.push(registration)

                    if (!registration.waitingList) {
                        groupMap.set(group.id, group)
                    } else {
                        if (registration.canRegister) {
                            acceptedWaitlistGroups.set(group.id, group)
                        } else {
                            waitlistGroups.set(group.id, group)
                        }
                    }
                }
            } else {
                console.error("Group not found", registration.groupId)
            }
        }
        this.groups = Array.from(groupMap.values())
        this.waitingGroups = Array.from(waitlistGroups.values())
        this.acceptedWaitingGroups = Array.from(acceptedWaitlistGroups.values())
        this.allGroups = groups.slice()
    }

    getAllEmails(): string[] {
        const emails = new Set<string>(this.details.getAllEmails())

        for (const user of this.users) {
            if (user.email) {
                emails.add(user.email)
            }
        }
        return [...emails]
    }

    canRegister(group: Group, family: MemberWithRegistrations[], categories: GroupCategory[], cart: (OldIDRegisterItem | OldRegisterItem)[]): CanRegisterResponse {
        return OldRegisterCartValidator.canRegister(this, group, family, this.allGroups, categories, cart)
    }

    /**
     * Instead of listening for changes to a member, editing components can push changes to existing instances
     */
    copyFrom(member: MemberWithRegistrations) {
        this.details = member.details
        this.activeRegistrations = member.activeRegistrations
        this.waitingGroups = member.waitingGroups
        this.acceptedWaitingGroups = member.acceptedWaitingGroups
        this.allGroups = member.allGroups
        
        if (member.groups !== this.groups) {
            this.groups.splice(0, this.groups.length, ...member.groups)
        }

        this.registrations = member.registrations

        if (member.users !== this.users) {
            this.users.splice(0, this.users.length, ...member.users)
        }
    }

    static getBaseFilterDefinitions(organization: Organization) {
        return [
            new StringFilterDefinition<MemberWithRegistrations>({
                id: "member_name", 
                name: "Naam lid", 
                getValue: (member) => {
                    return member?.name ?? ""
                }
            }),
            new RegistrationsFilterDefinition<MemberWithRegistrations>({
                id: "registrations", 
                name: "Inschrijvingen",
                getValue: (member) => {
                    const groups = member.groups.map(g => RegistrationsFilterChoice.create({
                        id: g.id,
                        name: g.settings.name,
                        waitingList: false
                    })) ?? []

                    const waitingGroups = member.waitingGroups.map(g => RegistrationsFilterChoice.create({
                        id: g.id,
                        name: g.settings.name,
                        waitingList: true
                    })) ?? []

                    return [...groups, ...waitingGroups]
                }
            }),
            new NumberFilterDefinition<MemberWithRegistrations>({
                id: "member_age", 
                name: "Leeftijd", 
                getValue: (member) => {
                    return member.details.age ?? 99
                },
                floatingPoint: false
            }),
            new DateFilterDefinition<MemberWithRegistrations>({
                id: "member_birthDay", 
                name: "Geboortedatum", 
                getValue: (member) => {
                    return member.details.birthDay ?? new Date(1900, 0, 1)
                },
                time: false
            }),

            new ChoicesFilterDefinition<MemberWithRegistrations>({
                id: "gender", 
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

            new ChoicesFilterDefinition<MemberWithRegistrations>({
                id: "member_missing_data", 
                name: "Ontbrekende gegevens", 
                description: "Toon leden als één van de geselecteerde gegevens ontbreekt of niet is ingevuld.",
                choices: [
                    ...(organization.meta.umbrellaOrganization === UmbrellaOrganization.ScoutsEnGidsenVlaanderen ? [new ChoicesFilterChoice("memberNumber", "Lidnummer")] : []),
                    new ChoicesFilterChoice("birthDay", "Geboortedatum"),
                    new ChoicesFilterChoice("address", "Adres", "Van lid zelf"),
                    new ChoicesFilterChoice("phone", "Telefoonnummer", "Van lid zelf"),
                    new ChoicesFilterChoice("email", "E-mailadres", "Van lid zelf"),
                    new ChoicesFilterChoice("parents", "Ouders"),
                    new ChoicesFilterChoice("secondParent", "Tweede ouder", "Als er maar één ouder is toegevoegd aan een lid. Handig om te selecteren op een eenoudergezin."),
                    new ChoicesFilterChoice("emergencyContact", "Noodcontact"),
                    ...organization.meta.recordsConfiguration.recordCategories.flatMap(c => c.childCategories.length > 0 ? c.childCategories : [c]).map(category => {
                        return new ChoicesFilterChoice("record-category-"+category.id, category.name)
                    })
                ], 
                getValue: (member) => {
                    const missing: string[] = []
                    if (!member.details.memberNumber) {
                        missing.push("memberNumber")
                    }

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

                    const categories = organization.meta.recordsConfiguration.recordCategories.flatMap(c => c.childCategories.length > 0 ? c.childCategories : [c])
                    const m = new MemberDetailsWithGroups(member.details, member, [])
                    for (const category of categories) {
                        const records = category.getAllFilteredRecords(m, MemberDetailsWithGroups.getBaseFilterDefinitions(), member.details.dataPermissions?.value ?? false)
                        const missingRecord = records.find(r => (r.required || r.type === RecordType.Checkbox || records.length == 1) && !member.details.recordAnswers.find(a => a.settings.id === r.id))
                        if (missingRecord) {
                            missing.push("record-category-"+category.id)
                        }
                    }
                    return missing
                },
                defaultMode: ChoicesFilterMode.Or
            }),

            new ChoicesFilterDefinition<MemberWithRegistrations>({
                id: "members_accounts", 
                name: "Accounts", 
                description: "Filter leden die wel of geen account hebben om de gegevens van leden te wijzigen via het ledenportaal.",
                choices: [
                    new ChoicesFilterChoice("no_account", "Heeft geen account"),
                    new ChoicesFilterChoice("has_account", "Heeft een account")
                ], 
                getValue: (member) => {
                    const missing: string[] = []
                    if (member.users.find(u => u.hasAccount)) {
                        missing.push("has_account")
                    } else {
                        missing.push("no_account")
                    }

                    return missing
                },
                defaultMode: ChoicesFilterMode.Or
            }),

            new NumberFilterDefinition<MemberWithRegistrations>({
                id: "outstandingBalance", 
                name: "Openstaand saldo", 
                getValue: (member) => {
                    return member.outstandingBalance
                },
                currency: true
            }),
            new ChoicesFilterDefinition<MemberWithRegistrations>({
                id: "financial_support", 
                name: "Financiële ondersteuning", 
                choices: [
                    new ChoicesFilterChoice("checked", "Vroeg financiële ondersteuning aan"),
                    new ChoicesFilterChoice("not_checked", "Geen financiële ondersteuning"),
                ], 
                getValue: (member) => {
                    // TODO: remove spaces
                    if (member.details.requiresFinancialSupport?.value) {
                        return ["checked"]
                    }
                    return ["not_checked"]
                }
            }),
            new ChoicesFilterDefinition<MemberWithRegistrations>({
                id: "data_permissions", 
                name: "Toestemming gegevensverzameling", 
                choices: [
                    new ChoicesFilterChoice("checked", "Gaf toestemming"),
                    new ChoicesFilterChoice("not_checked", "Gaf geen toestemming"),
                ], 
                getValue: (member) => {
                    // TODO: remove spaces
                    if (member.details.dataPermissions?.value) {
                        return ["checked"]
                    }
                    return ["not_checked"]
                }
            })
        ]
    }

    matchQuery(q: string) {
        return this.details.matchQuery(q)
    }
}
