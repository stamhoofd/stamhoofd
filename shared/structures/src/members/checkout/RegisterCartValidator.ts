import { SimpleError } from "@simonbackx/simple-errors"

import { Group } from "../../Group"
import { GroupCategory } from "../../GroupCategory"
import { WaitingListType } from "../../GroupSettings"
import { MemberWithRegistrations } from "../MemberWithRegistrations"
import { IDRegisterItem, RegisterItem } from "./RegisterItem"
import { UnknownMemberWithRegistrations } from "./UnknownMemberWithRegistrations"


/**
 * Class that can validate a Cart and registrations.
 * This is usefull to share the validation between backend and frontend (for both the encrypted and non-encrypted versions)
 */
export class RegisterCartValidator {
    static canRegister(member: UnknownMemberWithRegistrations, group: Group, family: UnknownMemberWithRegistrations[], groups: Group[], categories: GroupCategory[], cart: (IDRegisterItem | RegisterItem)[]): { closed: boolean; waitingList: boolean; message?: string; description?: string } {
        // Already registered
        if (member.registrations.find(r => r.groupId === group.id && r.registeredAt !== null && r.deactivatedAt === null && !r.waitingList)) {
            return {
                closed: true,
                waitingList: false,
                message: "Al ingeschreven"
            }
        }

        // Check all categories maximum limits
        if (this.hasReachedCategoryMaximum(member, group, categories, cart)) {
            // Only happens if maximum is reached in teh cart (because maximum without cart is already checked in shouldShow)
            return {
                closed: true,
                waitingList: false,
                message: "Niet combineerbaar",
                description: "Je kan niet meer inschrijven voor "+group.settings.name+" omdat je al ingeschreven bent of aan het inschrijven bent voor een groep die je niet kan combineren."
            }
        }

        if (group.notYetOpen) {
            return {
                closed: true,
                waitingList: false,
                message: "Nog niet geopend",
                description: "De inschrijvingen voor "+group.settings.name+" zijn nog niet geopend."
            }
        }

        if (group.closed) {
            return {
                closed: true,
                waitingList: false,
                message: "Gesloten",
                description: "De inschrijvingen voor "+group.settings.name+" zijn afgelopen."
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
                    description: "Momenteel zijn de voorinschrijvingen nog bezig voor "+group.settings.name+". Dit is enkel voor bestaande leden"+(group.settings.priorityForFamily ? " en hun broers/zussen" : "")+"."
                }
            }
        }

        if (group.settings.waitingListType === WaitingListType.All) {
            return {
                closed: false,
                waitingList: true,
                message: "Wachtlijst"
            };
        }

        if (group.settings.waitingListType === WaitingListType.ExistingMembersFirst && !existingMember) {
            return {
                closed: false,
                waitingList: true,
                message: "Wachtlijst nieuwe leden"
            };
        }

        // Check if reached maximum with cart
        // Check maximum
        if (group.settings.maxMembers !== null && group.settings.registeredMembers !== null) {
            const count = cart.filter(item => item.groupId === group.id && item.memberId !== member.id && !item.waitingList).length
            const reachedMaximum = group.settings.maxMembers <= group.settings.registeredMembers + count
            if (reachedMaximum) {
                if (!group.settings.waitingListIfFull) {
                    // Maximum reached without waiting list -> closed
                    return {
                        closed: true,
                        waitingList: false,
                        message: "Volzet"
                    }
                }

                // If this is already in the cart, no need to return 'waitingList: true'
                const item = cart.find(item => item.memberId === member.id && item.groupId === group.id)
                if (item && !item.waitingList) {
                    return {
                        closed: false,
                        waitingList: false
                    }
                }

                // Still allow waiting list
                return {
                    closed: false,
                    waitingList: true,
                    message: "Wachtlijst (volzet)"
                }
            }
        }
        
        // Normal registrations available
        return {
            closed: false,
            waitingList: false,
            message: group.activePreRegistrationDate ? 'Voorinschrijvingen' : undefined
        }
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
            if (!registration.waitingList && registration.registeredAt !== null && registration.deactivatedAt !== null && group && registration.cycle === group.cycle - 1) {
                // This was the previous year
                return true
            }
        }

        return false
    }

    /**
     * True if you cannot register because you reached the maximum of a group category
     */
    static hasReachedCategoryMaximum(member: UnknownMemberWithRegistrations, group: Group, all: GroupCategory[], cart: (IDRegisterItem | RegisterItem)[] = []): boolean {
        const parents = group.getParentCategories(all, false)

        for (const parent of parents) {
            if (parent.settings.maximumRegistrations !== null) {
                const count = member.registrations.filter(r => r.registeredAt !== null && !r.waitingList && r.deactivatedAt === null && parent.groupIds.includes(r.groupId)).length

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
                human: "Je kan "+member.firstName+" niet meer inschrijven voor "+group.settings.name+ (canRegister.message ? (' ('+canRegister.message+')') : '')
            })
        }

        if (!item.waitingList && canRegister.waitingList) {
            throw new SimpleError({
                code: "invalid_registration",
                message: "Registration not possible anymore",
                human: "Je kan "+member.firstName+" enkel nog inschrijven voor de wachtlijst van "+group.settings.name+ (canRegister.message ? (' ('+canRegister.message+')') : '')
            })
        }

        // Check already in cart
        if (previousItems.find(i => i.groupId === item.groupId && i.memberId === item.memberId)) {
            throw new SimpleError({
                code: "invalid_registration",
                message: "Duplicate item",
                human: "Je kan "+member.firstName+" maar één keer inschrijven voor "+group.settings.name
            })
        }

        // Check maximum
        if (group.settings.maxMembers !== null && !item.waitingList) {
            const count = previousItems.filter(i => i.groupId === item.groupId && !i.waitingList).length
            if (count >= group.settings.maxMembers - (group.settings.registeredMembers ?? 0)) {
                throw new SimpleError({
                    code: "invalid_registration",
                    message: "Reached maximum members allowed",
                    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                    human: "Er zijn nog maar " + (group.settings.maxMembers - (group.settings.registeredMembers ?? 0)) + " plaatsen meer vrij voor "+group.settings.name+". Je kan "+member.firstName+" niet meer inschrijven."+(group.settings.waitingListIfFull ? " Je kan wel op de wachtlijst inschrijven." : "")
                })
            }
        }
    }
}