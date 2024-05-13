import { AutoEncoder, BooleanDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { SimpleError } from "@simonbackx/simple-errors";
import { Formatter } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";

import { Group } from "../../Group";
import { WaitingListType } from "../../GroupSettings";
import { PlatformMember } from "../PlatformMember";


export type RegisterContext = {
    members: PlatformMember[],
    checkout: RegisterCheckout
}

export class IDRegisterItem extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    memberId: string

    @field({ decoder: StringDecoder })
    groupId: string

    @field({ decoder: StringDecoder })
    organizationId: string

    @field({ decoder: BooleanDecoder })
    waitingList = false
}


export class RegisterItem {
    id: string;
    member: PlatformMember
    group: Group
    waitingList = false

    constructor(data: {id?: string, member: PlatformMember, group: Group, waitingList: boolean}) {
        this.id = data.id ?? uuidv4()
        this.member = data.member
        this.group = data.group
        this.waitingList = data.waitingList
    }

    static defaultFor(member: PlatformMember, group: Group, context: RegisterContext) {
        const item = new RegisterItem({
            member,
            group,
            waitingList: false
        });
        item.waitingList = item.shouldUseWaitingList(context)
        return item;
    }

    get organization() {
        return this.member.organizations.find(o => o.id === this.group.organizationId)!
    }

    /**
     * Update self to the newest available data, and throw error if something failed (only after refreshing other ones)
     */
    refresh(context: RegisterContext) {
        // todo
    }

    isAlreadyRegistered() {
        return !!this.member.member.registrations.find(r => r.groupId === this.group.id && (this.waitingList || r.registeredAt !== null) && r.deactivatedAt === null && r.waitingList === this.waitingList && r.cycle === this.group.cycle)
    }
    
    hasReachedCategoryMaximum(context: RegisterContext): boolean {
        const parents = this.group.getParentCategories(this.organization.meta.categories, false)
    
        for (const parent of parents) {
            if (parent.settings.maximumRegistrations !== null) {
                const count = this.member.member.registrations.filter(r => {
                    if (r.registeredAt !== null && !r.waitingList && r.deactivatedAt === null && parent.groupIds.includes(r.groupId)) {
                        // Check cycle (only count current periods, not previous periods)
                        const g = this.organization.groups.find(gg => gg.id === r.groupId)
                        return g && g.cycle === r.cycle
                    }
                    return false
                }).length
    
                const waiting = context.checkout.cart.items.filter(item => {
                    return item.member.member.id === this.member.member.id && parent.groupIds.includes(item.group.id) && item.group.id !== this.group.id
                }).length
                if (count + waiting >= parent.settings.maximumRegistrations) {
                    return true
                }
            }
        }
        return false
    }

    isInvited() {
        return !!this.member.member.registrations.find(r => r.groupId === this.group.id && r.waitingList && r.canRegister && r.cycle === this.group.cycle)
    }

    doesMeetRequireGroupIds(context: RegisterContext) {
        if (this.group.settings.requireGroupIds.length > 0) {
            const hasGroup = this.member.member.registrations.find(r => {
                const registrationGroup = this.organization.groups.find(g => g.id === r.groupId)
                if (!registrationGroup) {
                    return false
                }
                return this.group.settings.requireGroupIds.includes(r.groupId) && r.registeredAt !== null && r.deactivatedAt === null && !r.waitingList && r.cycle === registrationGroup.cycle
            });

            if (!hasGroup && !context.checkout.cart.items.find(item => this.group.settings.requireGroupIds.includes(item.group.id) && item.member.member.id === this.member.member.id && !item.waitingList)) {
                return false;
            }
        }
        return true;
    }

    doesMeetRequirePreviousGroupIds() {
        if (this.group.settings.requirePreviousGroupIds.length > 0) {
            const hasGroup = this.member.member.registrations.find(r => {
                const registrationGroup = this.organization.groups.find(g => g.id === r.groupId)
                if (!registrationGroup) {
                    return false
                }
                return this.group.settings.requirePreviousGroupIds.includes(r.groupId) && r.registeredAt !== null && r.deactivatedAt === null && !r.waitingList && r.cycle === registrationGroup.cycle - 1
            });

            if (!hasGroup) {
                return false;
            }
        }
        return true;
    }

    doesMeetPreventPreviousGroupIds() {
        if (this.group.settings.preventPreviousGroupIds.length > 0) {
            const hasGroup = this.member.member.registrations.find(r => {
                const registrationGroup = this.organization.groups.find(g => g.id === r.groupId)
                if (!registrationGroup) {
                    return false
                }
                return this.group.settings.preventPreviousGroupIds.includes(r.groupId) && r.registeredAt !== null && r.deactivatedAt === null && !r.waitingList && r.cycle === registrationGroup.cycle - 1
            });

            if (hasGroup) {
                return false;
            }
        }
        return true;
    }

    isExistingMemberOrFamily(context: RegisterContext) {
        return this.member.isExistingMember(this.group.organizationId) || (this.group.settings.priorityForFamily && !!context.members.find(f => f.isExistingMember(this.group.organizationId)))
    }

    get rowLabel(): string|null {
        if (this.isInvited()) {
            return 'Uitnodiging'
        }

        return null
    }

    shouldUseWaitingList(context: RegisterContext) {
        if (this.group.settings.waitingListType === WaitingListType.All) {
            return true;
        }
        const existingMember = this.isExistingMemberOrFamily(context)

        if (this.group.settings.waitingListType === WaitingListType.ExistingMembersFirst && !existingMember) {
            return true;
        }

        if (this.group.settings.waitingListIfFull) {
            if (this.hasReachedGroupMaximum(context)) {
                return true;
            }
        }
        return false
    }

    hasReachedGroupMaximum(context: RegisterContext) {
        const available = this.group.settings.availableMembers
        if (available !== null) {
            const count = context.checkout.cart.items.filter(item => item.group.id === this.group.id && item.member.member.id !== this.member.member.id && !item.waitingList).length
            if (count >= available) {
                // Check if we have a reserved spot
                const now = new Date()
                const reserved = this.member.member.registrations.find(r => r.groupId === this.group.id && r.reservedUntil && r.reservedUntil > now && !r.waitingList && r.registeredAt === null && r.cycle === this.group.cycle)
                if (!reserved) {
                    return true
                }
            }
        }
        return false;
    }

    validate(context: RegisterContext) {
        // Already registered
        if (this.isAlreadyRegistered()) {
            throw new SimpleError({
                code: "already_registered",
                message: "Already registered",
                human: `${this.member.member.firstName} is al ingeschreven voor ${this.group.settings.name}`
            })
        }

        if (this.hasReachedCategoryMaximum(context)) {
            // Only happens if maximum is reached in teh cart (because maximum without cart is already checked in shouldShow)
            throw new SimpleError({
                code: "maximum_reached",
                message: "Maximum reached",
                human: `Je kan niet meer inschrijven voor ${this.group.settings.name} omdat je al ingeschreven bent of aan het inschrijven bent voor een groep die je niet kan combineren.`
            })
        }

        // Check if we have an invite (doesn't matter if registrations are closed)
        if (this.isInvited()) {
            return
        }

        if (this.group.notYetOpen) {
            throw new SimpleError({
                code: "not_yet_open",
                message: "Not yet open",
                human: `De inschrijvingen voor ${this.group.settings.name} zijn nog niet geopend.`
            })
        }

        if (this.group.closed) {
            throw new SimpleError({
                code: "closed",
                message: "Closed",
                human: `De inschrijvingen voor ${this.group.settings.name} zijn gesloten.`
            })
        }

        // Check if it fits
        if (this.member.member.details) {
            if (!this.member.member.details.doesMatchGroup(this.group)) {
                const error = this.member.member.details.getMatchingError(this.group);
                throw new SimpleError({
                    code: "not_matching",
                    message: "Not matching",
                    human: error?.description ?? "Je voldoet niet aan de voorwaarden om in te schrijven voor deze groep."
                })
            }
        }

         // Check if registrations are limited
        if (!this.doesMeetRequireGroupIds(context)) {
            throw new SimpleError({
                code: "not_matching",
                message: "Not matching",
                human:  "Inschrijving bij "+Formatter.joinLast(this.group.settings.requireGroupIds.map(id => this.organization.groups.find(g => g.id === id)?.settings.name ?? "Onbekend"), ", ", " of ")+" is verplicht voor je kan inschrijven voor "+this.group.settings.name,
            })
        }

        if (!this.doesMeetPreventPreviousGroupIds()) {
            throw new SimpleError({
                code: "not_matching",
                message: "Not matching",
                human: `Je voldoet niet aan de voorwaarden om in te schrijven voor ${this.group.settings.name}.`
            })
        }

        if (!this.doesMeetRequirePreviousGroupIds()) {
            throw new SimpleError({
                code: "not_matching",
                message: "Not matching",
                human: `Je voldoet niet aan de voorwaarden om in te schrijven voor ${this.group.settings.name}.`
            })
        }
        const existingMember = this.isExistingMemberOrFamily(context)

        // Pre registrations?
        if (this.group.activePreRegistrationDate) {
            if (!existingMember) {
                throw new SimpleError({
                    code: "pre_registrations",
                    message: "Pre registrations",
                    human: "Momenteel zijn de voorinschrijvingen nog bezig voor "+this.group.settings.name+". Dit is enkel voor bestaande leden"+(this.group.settings.priorityForFamily ? " en hun broers/zussen" : "")+"."
                })
            }
        }

        if (!this.waitingList && this.shouldUseWaitingList(context)) {
            throw new SimpleError({
                code: "waiting_list_required",
                message: "Waiting list required",
                human: `${this.member.member.firstName} kan momenteel enkel voor de wachtlijst van ${this.group.settings.name} inschrijven.`
            })
        }

        if (!this.waitingList) {
            if (!this.group.settings.waitingListIfFull) {
                if (this.hasReachedGroupMaximum(context)) {
                    throw new SimpleError({
                        code: "maximum_reached",
                        message: "Maximum reached",
                        human: `De inschrijvingen voor ${this.group.settings.name} zijn volzet. Je kan wel nog inschrijven voor de wachtlijst.`
                    })
                }
            } else {
                if (this.hasReachedGroupMaximum(context)) {
                    throw new SimpleError({
                        code: "maximum_reached",
                        message: "Maximum reached",
                        human: `De inschrijvingen voor ${this.group.settings.name} zijn volzet.`
                    })
                }
            }
        }

    }

    toId(): IDRegisterItem {
        return IDRegisterItem.create({
            id: this.id,
            memberId: this.member.member.id,
            groupId: this.group.id,
            organizationId: this.group.organizationId,
            waitingList: this.waitingList
        })
    }

    static fromId(idRegisterItem: IDRegisterItem, context: RegisterContext) {
        const member = context.members.find(m => m.member.id === idRegisterItem.memberId)
        if (!member) {
            throw new Error("Member not found")
        }

        const organization = member.organizations.find(o => o.id === idRegisterItem.organizationId)
        if (!organization) {
            throw new Error("Organization not found")
        }

        const group = organization.groups.find(g => g.id === idRegisterItem.groupId)
        if (!group) {
            throw new Error("Group not found")
        }

        return new RegisterItem({
            id: idRegisterItem.id,
            member,
            group,
            waitingList: idRegisterItem.waitingList
        })
    }
}

export class RegisterCart {
    items: RegisterItem[] = []

}

export class RegisterCheckout{
    cart = new RegisterCart()

    validate() {
        // todo
    }


    canRegister(member: PlatformMember, group: Group) {
       
    }
}
