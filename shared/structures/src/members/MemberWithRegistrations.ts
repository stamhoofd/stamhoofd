import { ArrayDecoder, field } from '@simonbackx/simple-encoding';

import { Group } from '../Group';
import { GroupCategory } from '../GroupCategory';
import { WaitingListType } from '../GroupSettings';
import { PaymentStatus } from '../PaymentStatus';
import { User } from '../User';
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

    get isNew(): boolean {
        if (this.inactiveRegistrations.length === 0) {
            return true
        }

        // Check if no year was skipped
        for (const registration of this.inactiveRegistrations) {
            const group = this.allGroups.find(g => g.id === registration.groupId)
            if (group && registration.cycle === group.cycle - 1) {
                // This was the previous year
                return true
            }
        }

        return false
    }

    /**
     * Return true if this member was registered in the previous year (current doesn't count)
     */
    get isExistingMember(): boolean {
        if (this.inactiveRegistrations.length === 0) {
            return false
        }

        // Check if no year was skipped
        for (const registration of this.inactiveRegistrations) {
            const group = this.allGroups.find(g => g.id === registration.groupId)
            if (group && registration.cycle === group.cycle - 1) {
                // This was the previous year
                return true
            }
        }

        return false
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
                if (group.cycle == registration.cycle && registration.deactivatedAt === null) {
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

    getRegistrationInfo(group: Group, family: MemberWithRegistrations[]): { closed: boolean; waitingList: boolean; message?: string } {
        if (group.notYetOpen) {
            return {
                closed: true,
                waitingList: false,
                message: "Nog niet geopend"
            }
        }

        if (group.closed) {
            return {
                closed: true,
                waitingList: false,
                message: "Gesloten"
            }
        }

        const existingMember = this.isExistingMember || (group.settings.priorityForFamily && !!family.find(f => f.isExistingMember))

        // Pre registrations?
        if (group.activePreRegistrationDate) {
            if (!existingMember) {
                return {
                    closed: true,
                    waitingList: false,
                    message: "Voorinschrijvingen"
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
                message: "Wachtlijst"
            };
        }

        const reachedMaximum = group.settings.maxMembers !== null && group.settings.registeredMembers !== null && group.settings.maxMembers <= group.settings.registeredMembers
        if (reachedMaximum) {
            if (!group.settings.waitingListIfFull) {
                // Maximum reached without waiting list -> closed
                return {
                    closed: true,
                    waitingList: false,
                    message: "Volzet"
                }
            }

            // Still allow waiting list
            return {
                closed: false,
                waitingList: true,
                message: "Wachtlijst (volzet)"
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
     * True if you cannot register because you reached the maximum of a group category
     */
    hasReachedMaximum(group: Group, all: GroupCategory[]): boolean {
        const parents = group.getParentCategories(all)

        for (const parent of parents) {
            if (parent.settings.maximumRegistrations !== null) {
                const count = this.groups.filter(g => parent.groupIds.includes(g.id)).length
                if (count >= parent.settings.maximumRegistrations) {
                    return true
                }
            }
        }
        return false
    }

    doesMatchGroup(group: Group, all: GroupCategory[]): boolean {
        return this.getMatchingError(group, all) === null
    }

    /**
     * Can this member still register in a new group or waiting list?
     */
    getMatchingError(group: Group, all: GroupCategory[]): string | null {        
        // Check all categories maximum limits
        if (this.hasReachedMaximum(group, all)) {
            return "Al ingeschreven voor maximum aantal"
        }

        if (this.groups.find(g => g.id === group.id)) {
            return "Al ingeschreven"
        }

        if (!this.details) {
            // we have no clue!
            return null
        }

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
        
        if (member.groups !== this.groups) {
            this.groups.splice(0, this.groups.length, ...member.groups)
        }

        this.registrations = member.registrations

        if (member.users !== this.users) {
            this.users.splice(0, this.users.length, ...member.users)
        }
    }
}