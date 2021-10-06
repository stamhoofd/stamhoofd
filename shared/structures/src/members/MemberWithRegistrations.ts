import { ArrayDecoder, field } from '@simonbackx/simple-encoding';

import { ChoicesFilterChoice, ChoicesFilterDefinition, ChoicesFilterMode } from '../filters/ChoicesFilter';
import { StringFilterDefinition } from '../filters/StringFilter';
import { Group } from '../Group';
import { GroupCategory } from '../GroupCategory';
import { WaitingListType } from '../GroupSettings';
import { PaymentStatus } from '../PaymentStatus';
import { User } from '../User';
import { RegisterCartValidator } from './checkout/RegisterCartValidator';
import { IDRegisterItem, RegisterItem } from './checkout/RegisterItem';
import { Gender } from './Gender';
import { Member } from './Member';
import { Registration } from './Registration';


export class MemberWithRegistrations extends Member {
    @field({ decoder: new ArrayDecoder(Registration) })
    registrations: Registration[]

    @field({ decoder: new ArrayDecoder(User), version: 32 })
    users: User[]

    // Calculated properties for convenience
    @field({ decoder: new ArrayDecoder(Registration), optional: true })
    activeRegistrations: Registration[] = []

    get inactiveRegistrations() {
        return this.registrations.filter(r => !!this.activeRegistrations.find(r2 => r2.id == r.id))
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
        return RegisterCartValidator.isExistingMember(this, this.allGroups)
    }

    static fromMember(member: Member, registrations: Registration[], users: User[], groups: Group[]) {
        const m = MemberWithRegistrations.create({
            ...member,
            registrations,
            users
        })
        m.fillGroups(groups)
        return m
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
            }
        }
        this.groups = Array.from(groupMap.values())
        this.waitingGroups = Array.from(waitlistGroups.values())
        this.acceptedWaitingGroups = Array.from(acceptedWaitlistGroups.values())
        this.allGroups = groups.slice()
    }
    
    get paid(): boolean {
        return !this.activeRegistrations.find(r => r.payment && r.payment.status != PaymentStatus.Succeeded)
    }

    get info(): string {
        return this.paid ? "" : "Lidgeld nog niet betaald";
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

    canRegister(group: Group, family: MemberWithRegistrations[], categories: GroupCategory[], cart: (IDRegisterItem | RegisterItem)[]): { closed: boolean; waitingList: boolean; message?: string; description?: string } {
        return RegisterCartValidator.canRegister(this, group, family, this.allGroups, categories, cart)
    }

    /**
     * True if you cannot register because you reached the maximum of a group category
     */
    private hasReachedCategoryMaximum(group: Group, all: GroupCategory[], cart: (IDRegisterItem | RegisterItem)[] = []): boolean {
        return RegisterCartValidator.hasReachedCategoryMaximum(this, group, this.allGroups, all, cart)
    }

    /**
     * Return true if this is a suggested group for this members
     */
    shouldShowGroup(group: Group, groups: Group[], all: GroupCategory[]): boolean {
        return this.shouldShowGroupError(group, groups, all) === null
    }

    /**
     * These messages are generally not visible, just for reference
     */
    private shouldShowGroupError(group: Group, groups: Group[], all: GroupCategory[]): string | null {        
        // Check all categories maximum limits
        if (this.hasReachedCategoryMaximum(group, all)) {
            return "Al ingeschreven voor maximum aantal"
        }

        // Check if registrations are limited
        if (group.settings.requireGroupIds.length > 0) {
            if (!this.registrations.find(r => {
                const registrationGroup = groups.find(g => g.id === r.groupId)
                if (!registrationGroup) {
                    return false
                }
                return group.settings.requireGroupIds.includes(r.groupId) && r.registeredAt !== null && r.deactivatedAt === null && !r.waitingList && r.cycle === registrationGroup.cycle
            })) {
                return "Niet toegelaten"
            }
        }

        // Check if registrations are limited
        if (group.settings.preventPreviousGroupIds.length > 0) {
            if (this.registrations.find(r => {
                const registrationGroup = groups.find(g => g.id === r.groupId)
                if (!registrationGroup) {
                    return false
                }
                return group.settings.preventPreviousGroupIds.includes(r.groupId) && r.registeredAt !== null && r.deactivatedAt === null && !r.waitingList && r.cycle === registrationGroup.cycle - 1
            })) {
                return "Niet toegelaten"
            }
        }

        // Check if registrations are limited
        if (group.settings.requirePreviousGroupIds.length > 0) {
            if (!this.registrations.find(r => {
                const registrationGroup = groups.find(g => g.id === r.groupId)
                if (!registrationGroup) {
                    return false
                }
                return group.settings.requirePreviousGroupIds.includes(r.groupId) && r.registeredAt !== null && r.deactivatedAt === null && !r.waitingList && r.cycle === registrationGroup.cycle - 1
            })) {
                return "Niet toegelaten"
            }
        }

        // Already registered
        if (this.groups.find(g => g.id === group.id)) {
            return "Al ingeschreven"
        }

        // If activity ended and closed
        if (group.closed && group.settings.endDate < new Date()) {
            return "Inschrijvingen gesloten"
        }

        // If closed for more than 2 weeks: hide this group
        if (group.settings.endDate < new Date(new Date().getTime() - 1000*60*60*24*14)) {
            return "Inschrijvingen gesloten"
        }

        // too young / too old / etc
        if (!this.details.doesMatchGroup(group)) {
            return this.details.getMatchingError(group)
        }

        return null
    }

    /**
     * Instead of listening for changes to a member, editing components can push changes to existing instances
     */
    copyFrom(member: MemberWithRegistrations) {
        this.firstName = member.firstName
        this.details = member.details
        this.activeRegistrations = member.activeRegistrations
        this.waitingGroups = member.waitingGroups
        this.acceptedWaitingGroups = member.acceptedWaitingGroups
        this.encryptedDetails = member.encryptedDetails
        this.allGroups = member.allGroups
        
        if (member.groups !== this.groups) {
            this.groups.splice(0, this.groups.length, ...member.groups)
        }

        this.registrations = member.registrations

        if (member.users !== this.users) {
            this.users.splice(0, this.users.length, ...member.users)
        }
    }

    static getBaseFilterDefinitions() {
        return [
            new StringFilterDefinition<MemberWithRegistrations>({
                id: "member_name", 
                name: "Naam lid", 
                getValue: (member) => {
                    return member?.name ?? ""
                }
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
                id: "paid", 
                name: "Betaling", 
                choices: [
                    new ChoicesFilterChoice("checked", "Betaald"),
                    new ChoicesFilterChoice("not_checked", "Niet betaald"),
                ], 
                getValue: (member) => {
                    // todo: remove spaces
                    if (member.paid) {
                        return ["checked"]
                    }
                    return ["not_checked"]
                },
                defaultMode: ChoicesFilterMode.Or
            }),
            new ChoicesFilterDefinition<MemberWithRegistrations>({
                id: "financial_support", 
                name: "Financiële ondersteuning", 
                choices: [
                    new ChoicesFilterChoice("checked", "Vroeg financiële ondersteuning aan"),
                    new ChoicesFilterChoice("not_checked", "Geen financiële ondersteuning"),
                ], 
                getValue: (member) => {
                    // todo: remove spaces
                    if (member.details.requiresFinancialSupport?.value) {
                        return ["checked"]
                    }
                    return ["not_checked"]
                }
            })
        ]
    }
}