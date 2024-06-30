import { ArrayDecoder, field } from '@simonbackx/simple-encoding';

import { Group } from '../Group';
import { GroupCategory } from '../GroupCategory';
import { CanRegisterResponse, OldRegisterCartValidator } from './checkout/OldRegisterCartValidator';
import { OldIDRegisterItem, OldRegisterItem } from './checkout/OldRegisterItem';
import { MemberWithRegistrationsBlob } from './MemberWithRegistrationsBlob';
import { Registration } from './Registration';

/**
 * @deprecated
 * Use PlatformMember instead
 */
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
     * @deprecated
     * All groups of this organization (used for finding information of groups)
     */
    @field({ decoder: new ArrayDecoder(Group), optional: true })
    allGroups: Group[] = []

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

    matchQuery(q: string) {
        return this.details.matchQuery(q)
    }
}
