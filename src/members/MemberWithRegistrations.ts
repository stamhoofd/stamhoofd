import { ArrayDecoder, field } from '@simonbackx/simple-encoding';

import { Group } from '../Group';
import { PaymentStatus } from '../PaymentStatus';
import { Member } from './Member';
import { Registration } from './Registration';

export class SelectedGroup {
    group: Group;

    /**
     * Whether this group is selected to register on the waiting list
     */
    waitingList: boolean

    constructor(group: Group, waitingList: boolean) {
        this.group = group
        this.waitingList = waitingList
    }
}

export class MemberWithRegistrations extends Member {
    @field({ decoder: new ArrayDecoder(Registration) })
    registrations: Registration[]

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

    }
    
    get paid(): boolean {
        return !this.activeRegistrations.find(r => r.payment && r.payment.status != PaymentStatus.Succeeded)
    }

    get info(): string {
        return this.paid ? "" : "Lidgeld nog niet betaald";
    }

    /**
     * Return an instance of SelectedGroup if this group is selected (and still selectable) (contains information about whether it is selected for the waiting list or not)
     */
    getSelectedGroup(group: Group): SelectedGroup | null {
        if (!this.details) {
            return null
        }

        for (const pref of this.details.preferredGroups) {
            if (pref.groupId === group.id && pref.cycle === group.cycle) {
                // Is this group an acceptedWaitingGroups + not on waiting list?
                if (this.acceptedWaitingGroups.find(g => g.id == pref.groupId)) {
                    // Automatically select this group as a non waiting list group
                    return new SelectedGroup(group, false)
                }

                // Check if pref waitlist is valid
                if (group.shouldKnowExisting() && (this.details.existingStatus == null || this.details.existingStatus.isExpired())) {
                    // We need to know the existing status before we can determine if this group is selectable
                    return null
                }

                if (group.isWaitingList(this.details.existingStatus) !== pref.waitingList) {
                    // Became invalid = ignore
                    return null
                }

                try {
                    group.canRegisterInGroup(this.details.existingStatus)
                } catch (e) {
                    // Registrations might be closed
                    return null;
                }

                return new SelectedGroup(group, pref.waitingList);
            }
        }
        return null;
    }

    /**
     * Return the groups that are currently selected for registration, optionally filter by waitingList
     */
    getSelectedGroups(groups: Group[]): SelectedGroup[] {
        if (!this.details) {
            return []
        }

        const selectedGroups: SelectedGroup[] = []
        for (const group of groups) {
            const selectedGroup = this.getSelectedGroup(group)
            if (selectedGroup) {
                selectedGroups.push(selectedGroup)
            }
        }

        return selectedGroups
    }
}