import { SimpleError } from "@simonbackx/simple-errors"
import { Formatter } from "@stamhoofd/utility"

import { Group } from "../../Group"
import { GroupCategory } from "../../GroupCategory"
import { WaitingListType } from "../../GroupSettings"
import { MemberWithRegistrations } from "../MemberWithRegistrations"
import { IDRegisterItem, RegisterItem } from "./RegisterItem"
import { UnknownMemberWithRegistrations } from "./UnknownMemberWithRegistrations"

export type CanRegisterResponse = { closed: boolean; waitingList: boolean; message?: string; description?: string, invited: boolean};

/**
 * Class that can validate a Cart and registrations.
 * This is usefull to share the validation between backend and frontend (for both the encrypted and non-encrypted versions)
 */
export class RegisterCartValidator {
    static isAlreadyRegistered(member: UnknownMemberWithRegistrations, group: Group, waitingList: boolean) {
        return !!member.registrations.find(r => r.groupId === group.id && (waitingList || r.registeredAt !== null) && r.deactivatedAt === null && r.waitingList === waitingList && r.cycle === group.cycle)
    }
    static canRegister(member: UnknownMemberWithRegistrations, group: Group, family: UnknownMemberWithRegistrations[], groups: Group[], categories: GroupCategory[], cart: (IDRegisterItem | RegisterItem)[]): CanRegisterResponse {
        // Already registered
        if (this.isAlreadyRegistered(member, group, false)) {
            return {
                closed: true,
                waitingList: false,
                message: "Al ingeschreven",
                description: "Je kan "+member.details.firstName+" maar één keer inschrijven voor "+group.settings.name,
                invited: false
            }
        }

        // Check all categories maximum limits
        if (this.hasReachedCategoryMaximum(member, group, groups, categories, cart)) {
            // Only happens if maximum is reached in teh cart (because maximum without cart is already checked in shouldShow)
            return {
                closed: true,
                waitingList: false,
                message: "Niet combineerbaar",
                description: "Je kan niet meer inschrijven voor "+group.settings.name+" omdat je al ingeschreven bent of aan het inschrijven bent voor een groep die je niet kan combineren.",
                invited: false
            }
        }

        if (group.notYetOpen) {
            return {
                closed: true,
                waitingList: false,
                message: "Nog niet geopend",
                description: "De inschrijvingen voor "+group.settings.name+" zijn nog niet geopend.",
                invited: false
            }
        }

        if (group.closed) {
            return {
                closed: true,
                waitingList: false,
                message: "Gesloten",
                description: "De inschrijvingen voor "+group.settings.name+" zijn afgelopen.",
                invited: false
            }
        }

        // Check if we have an invite (doesn't matter if registrations are closed)
        if (member.registrations.find(r => r.groupId === group.id && r.waitingList && r.canRegister && r.cycle === group.cycle)) {
            // Max members doesn't matter (invites are counted into the occupancy)
            return {
                closed: false,
                waitingList: false,
                message: "Uitnodiging",
                description: "Je bent uitgenodigd om "+member.details.firstName+" in te schrijven voor "+group.settings.name,
                invited: true
            }
        }

        // Check if it fits
        if (member.details) {
            if (!member.details.doesMatchGroup(group)) {
                return {
                    closed: true,
                    waitingList: false,
                    ...member.details.getMatchingError(group),
                    invited: false
                }
            }
        }

        // Check if registrations are limited
        if (group.settings.requireGroupIds.length > 0) {
            if (!member.registrations.find(r => {
                const registrationGroup = groups.find(g => g.id === r.groupId)
                if (!registrationGroup) {
                    return false
                }
                return group.settings.requireGroupIds.includes(r.groupId) && r.registeredAt !== null && r.deactivatedAt === null && !r.waitingList && r.cycle === registrationGroup.cycle
            }) && !cart.find(item => group.settings.requireGroupIds.includes(item.groupId) && item.memberId === member.id && !item.waitingList)) {
                return {
                    closed: true,
                    waitingList: false,
                    message: "Niet toegelaten",
                    description: "Inschrijving bij "+Formatter.joinLast(group.settings.requireGroupIds.map(id => groups.find(g => g.id === id)?.settings.name ?? "Onbekend"), ", ", " of ")+" is verplicht voor je kan inschrijven voor "+group.settings.name,
                    invited: false
                }
            }
        }

        // Check if registrations are limited
        if (group.settings.preventPreviousGroupIds.length > 0) {
            if (member.registrations.find(r => {
                const registrationGroup = groups.find(g => g.id === r.groupId)
                if (!registrationGroup) {
                    return false
                }
                return group.settings.preventPreviousGroupIds.includes(r.groupId) && r.registeredAt !== null && r.deactivatedAt === null && !r.waitingList && r.cycle === registrationGroup.cycle - 1
            })) {
                return {
                    closed: true,
                    waitingList: false,
                    message: "Niet toegelaten",
                    description: "Inschrijven voor "+group.settings.name+" kan enkel als je de vorige keer niet was ingeschreven voor "+Formatter.joinLast(group.settings.preventPreviousGroupIds.map(id => groups.find(g => g.id === id)?.settings.name ?? "Onbekend"), ", ", " of "),
                    invited: false
                }
            }
        }

        // Check if registrations are limited
        if (group.settings.requirePreviousGroupIds.length > 0) {
            if (!member.registrations.find(r => {
                const registrationGroup = groups.find(g => g.id === r.groupId)
                if (!registrationGroup) {
                    return false
                }
                return group.settings.requirePreviousGroupIds.includes(r.groupId) && r.registeredAt !== null && r.deactivatedAt === null && !r.waitingList && r.cycle === registrationGroup.cycle - 1
            })) {
                return {
                    closed: true,
                    waitingList: false,
                    message: "Niet toegelaten",
                    description: "Inschrijven voor "+group.settings.name+" kan enkel als je de vorige keer was ingeschreven voor "+Formatter.joinLast(group.settings.requirePreviousGroupIds.map(id => groups.find(g => g.id === id)?.settings.name ?? "Onbekend"), ", ", " of "),
                    invited: false
                }
            }
        }

        const existingMember = this.isExistingMember(member, groups) || (group.settings.priorityForFamily && !!family.find(f => this.isExistingMember(f, groups)))

        // Pre registrations?
        if (group.activePreRegistrationDate) {
            if (!existingMember) {
                return {
                    closed: true,
                    waitingList: false,
                    message: "Voorinschrijvingen",
                    description: "Momenteel zijn de voorinschrijvingen nog bezig voor "+group.settings.name+". Dit is enkel voor bestaande leden"+(group.settings.priorityForFamily ? " en hun broers/zussen" : "")+".",
                    invited: false
                }
            }
        }

        if (group.settings.waitingListType === WaitingListType.All) {
            if (this.isAlreadyRegistered(member, group, true)) {
                return {
                    closed: true,
                    waitingList: false,
                    message: "Al op wachtlijst",
                    description: member.details.firstName+" staat al op de wachtlijst voor "+group.settings.name,
                    invited: false
                }
            }
            return {
                closed: false,
                waitingList: true,
                message: "Wachtlijst",
                description: this.getAlreadyInCartDescription({member, group, cart, waitingList: true}) ?? 'Je kan inschrijven op de wachtlijst',
                invited: false
            };
        }

        if (group.settings.waitingListType === WaitingListType.ExistingMembersFirst && !existingMember) {
            if (this.isAlreadyRegistered(member, group, true)) {
                return {
                    closed: true,
                    waitingList: false,
                    message: "Al op wachtlijst",
                    description: member.details.firstName+" staat al op de wachtlijst voor "+group.settings.name,
                    invited: false
                }
            }

            return {
                closed: false,
                waitingList: true,
                message: "Wachtlijst nieuwe leden",
                description: this.getAlreadyInCartDescription({member, group, cart, waitingList: true}),
                invited: false
            };
        }

        // Check if reached maximum with cart
        // Check maximum
        const available = group.settings.availableMembers
        if (available !== null) {
            const count = cart.filter(item => item.groupId === group.id && item.memberId !== member.id && !item.waitingList).length
            const reachedMaximum = count >= available
            if (reachedMaximum) {
                // Check if we have a reserved spot
                const now = new Date()
                const reserved = member.registrations.find(r => r.groupId === group.id && r.reservedUntil && r.reservedUntil > now && !r.waitingList && r.registeredAt === null && r.cycle === group.cycle)

                if (!reserved) {
                    if (!group.settings.waitingListIfFull) {
                        // Maximum reached without waiting list -> closed
                        return {
                            closed: true,
                            waitingList: false,
                            message: "Volzet",
                            description: available > 0 ? ("Er zijn nog maar " + available + " plaatsen meer vrij voor "+group.settings.name+". Je kan "+member.details.firstName+" niet meer inschrijven.") : ("Er zijn geen plaatsen meer vrij voor "+group.settings.name+". Je kan "+member.details.firstName+" niet meer inschrijven."),
                            invited: false
                        }
                    }

                    if (this.isAlreadyRegistered(member, group, true)) {
                        return {
                            closed: true,
                            waitingList: false,
                            message: "Al op wachtlijst",
                            description: member.details.firstName+" staat al op de wachtlijst voor "+group.settings.name,
                            invited: false
                        }
                    }

                    // Still allow waiting list
                    return {
                        closed: false,
                        waitingList: true,
                        message: "Wachtlijst (volzet)",
                        description: (this.getAlreadyInCartDescription({member, group, cart, waitingList: true}) ?? "") + (available > 0 ? ("Er zijn nog maar " + available + " plaatsen meer vrij voor "+group.settings.name+". Je kan "+member.details.firstName+" niet meer inschrijven. Je kan wel nog inschrijven voor de wachtlijst.") : "Er zijn geen plaatsen meer vrij voor "+group.settings.name+". Je kan "+member.details.firstName+" niet meer inschrijven.  Je kan wel nog inschrijven voor de wachtlijst."),
                        invited: false
                    }
                } else {
                    return {
                        closed: false,
                        waitingList: false,
                        message: "Tijdelijk gereserveerd",
                        invited: false
                    }
                }
            }
        }
        
        // Normal registrations available
        return {
            closed: false,
            waitingList: false,
            message: group.activePreRegistrationDate ? 'Voorinschrijvingen' : undefined,
            description: this.getAlreadyInCartDescription({member, group, cart, waitingList: false}),
            invited: false
        }
    }

    static getAlreadyInCartDescription({member, group, waitingList, cart}: {member: UnknownMemberWithRegistrations, group: Group, waitingList: boolean, cart: (IDRegisterItem | RegisterItem)[]}) {
        const item = cart.find(item => item.memberId === member.id && item.groupId === group.id)
        if (!item) {
            return
        }

        if (item.waitingList) {
            if (!waitingList) {
                // From waitingList -> normal registration is possible and doesn't need a warning
                return;
            }
            return "Dit staat klaar in jouw mandje. Bevestig het mandje om jouw plaats op de wachtlijst te bevestigen. "
        }

        return "Dit staat klaar in jouw mandje. Bevestig het mandje om jouw plaats om jouw inschrijving te bevestigen. "
    }

    /**
     * Return true if this member was registered in the previous year (current doesn't count)
     */
    static isExistingMember(member: UnknownMemberWithRegistrations, groups: Group[]): boolean {
        if (member.registrations.length === 0) {
            return false
        }

        // Check if no year was skipped
        for (const registration of member.registrations) {
            const group = groups.find(g => g.id === registration.groupId)
            if (group === undefined) {
                // Archived or deleted. Use the registeredAt date (should be in the last 1.5 years)
                if (registration.registeredAt !== null && registration.deactivatedAt === null && registration.waitingList === false && registration.registeredAt > new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 365 * 1.5)) {
                    return true
                }
                continue;
            }
            if (!registration.waitingList && registration.registeredAt !== null && registration.deactivatedAt === null && group && registration.cycle === group.cycle - 1) {
                // This was the previous year
                return true
            }
        }

        return false
    }

    /**
     * True if you cannot register because you reached the maximum of a group category
     */
    static hasReachedCategoryMaximum(member: UnknownMemberWithRegistrations, group: Group, groups: Group[], categories: GroupCategory[], cart: (IDRegisterItem | RegisterItem)[] = []): boolean {
        const parents = group.getParentCategories(categories, false)

        for (const parent of parents) {
            if (parent.settings.maximumRegistrations !== null) {
                const count = member.registrations.filter(r => {
                    if (r.registeredAt !== null && !r.waitingList && r.deactivatedAt === null && parent.groupIds.includes(r.groupId)) {
                        // Check cycle (only count current periods, not previous periods)
                        const g = groups.find(gg => gg.id === r.groupId)
                        return g && g.cycle === r.cycle
                    }
                    return false
                }).length

                const waiting = cart.filter(item => {
                    return item.memberId === member.id && parent.groupIds.includes(item.groupId) && item.groupId !== group.id
                }).length
                if (count + waiting >= parent.settings.maximumRegistrations) {
                    return true
                }
            }
        }
        return false
    }


    static validateItem(item: IDRegisterItem | RegisterItem, family: UnknownMemberWithRegistrations[], groups: Group[], categories: GroupCategory[], previousItems: (IDRegisterItem | RegisterItem)[]) {
        const member = family.find(m => m.id === item.memberId)
        const group = groups.find(g => g.id === item.groupId)

        if (!member) {
            throw new SimpleError({
                code: "invalid_member",
                message: "Invalid member",
                human: "Het lid dat je wilt inschrijven bestaat niet (meer)"
            })
        }

        if (!group) {
            throw new SimpleError({
                code: "invalid_group",
                message: "Invalid group",
                human: "De inschrijvingsgroep waarvoor je wilt inschrijven bestaat niet (meer)"
            })
        }

        const canRegister = this.canRegister(member, group, family, groups, categories, previousItems)
        if (canRegister.closed) {
            throw new SimpleError({
                code: "invalid_registration",
                message: "Registration not possible anymore",
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                human: canRegister.description ? canRegister.description : ("Je kan "+member.details.firstName+" niet meer inschrijven voor "+group.settings.name+ (canRegister.message ? (' ('+canRegister.message+')') : ''))
            })
        }

        if (!item.waitingList && canRegister.waitingList) {
            throw new SimpleError({
                code: "invalid_registration",
                message: "Registration not possible anymore, waiting list required",
                human: canRegister.description ? canRegister.description : ("Je kan "+member.details.firstName+" enkel nog inschrijven voor de wachtlijst van "+group.settings.name+ (canRegister.message ? (' ('+canRegister.message+')') : ''))
            })
        }

        if (item.waitingList && !canRegister.waitingList) {
            throw new SimpleError({
                code: "invalid_registration",
                message: "Waiting list not possible",
                human: "Je hoeft "+member.details.firstName+" niet langer op de wachtlijst van "+group.settings.name+" in te schrijven. We hebben het uit je winkelmandje verwijderd, voeg het opnieuw toe zonder wachtlijst."
            })
        }
    }
}