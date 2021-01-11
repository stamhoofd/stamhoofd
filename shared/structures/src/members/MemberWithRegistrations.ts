import { ArrayDecoder, field } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';

import { Group } from '../Group';
import { WaitingListSkipReason } from '../GroupSettings';
import { PaymentStatus } from '../PaymentStatus';
import { User } from '../User';
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



export class SelectableGroup {
    group: Group;

    /**
     * Whether still in pre registration phase
     */
    get preRegistrations(): boolean {
        return !!this.group.activePreRegistrationDate
    }

    /**
     * Ask existing status before selecting this group
     */
    askExistingStatus = false

    /**
     * Whether waiting lists are enabled for this group
     */
    get waitingList(): boolean {
        return this.group.hasWaitingList()
    }

    /**
     * Whether waiting lists are enabled for this group
     */
    get willJoinWaitingList(): boolean {
        return this.group.hasWaitingList() && this.skipReason === null
    }

    /**
     * If a skip reason is set, we won't register on the waiting list
     */
    skipReason: WaitingListSkipReason | null

    alreadyOnWaitingList = false
    alreadyRegistered = false

    constructor(group: Group, skipReason: WaitingListSkipReason | null, askExistingStatus: boolean) {
        this.group = group
        this.skipReason = skipReason
        this.askExistingStatus = askExistingStatus
    }

    /**
     * Throw if you cannot register
     */
    canRegister(member: MemberWithRegistrations) {
        if (!member.details) {
            return false
        }

        if (this.askExistingStatus) {
            return false;
        }

        if (this.alreadyOnWaitingList && this.willJoinWaitingList) {
            throw new SimpleError({
                code: "already_on_waiting_list",
                message: "Je staat al op de wachtlijst",
            })
        }

        if (this.alreadyRegistered) {
            throw new SimpleError({
                code: "already_registered",
                message: "Je bent al ingeschreven voor deze groep",
            })
        }

        this.group.canRegisterInGroup(member.details.existingStatus)
    }
}

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
                const selectables = this.getSelectableGroups([group])
                if (selectables.length == 0) {
                    return null
                }

                const selectable = selectables[0]

                if (selectable.alreadyRegistered) {
                    // Already registered
                    return null
                }

                if (selectable.skipReason == WaitingListSkipReason.Invitation) {
                    // Received an invitation, we can keep it selected without a waiting list
                    return new SelectedGroup(group, false)
                }

                 if (selectable.alreadyOnWaitingList) {
                    // Already on waiting list, and no invitation
                    return null
                }

                if (selectable.willJoinWaitingList && !pref.waitingList) {
                    // we do allow joining the waiting list if it is not required (e.g. when a pre register group is full)
                    return null
                }

                if (selectable.askExistingStatus) {
                    // We need to know the existing status before we can determine if this group is selectable
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

    /**
     * Whether we should ask parents, emergency contacts and records
     */
    shouldAskDetails(groups: Group[]) {
        if (this.groups.length > 0) {
            return true
        }

        // only depends on the selected groups at this point
        if (this.getSelectedGroups(groups).find(g => !g.waitingList)) {
            // We want to register
            return true
        }

        // Only want to put on waiting list (or none selected)
        return false
    }

    isCompleteForSelectedGroups(groups: Group[]): boolean {
        const selectedGroups = this.getSelectedGroups(groups)

        if (selectedGroups.length == 0) {
            return true
        }

        // waitingList = true if all groups are waiting lists
        const waitingList = !selectedGroups.find(g => !g.waitingList)
        return this.isComplete(waitingList)
    }

    /**
     * Can this member still register in a new group or waiting list?
     */
    hasActiveRegistrations() {
        // todo: atm it is not possible to register a member in multiple groups
        if (this.activeRegistrations.find(r => !r.waitingList)) {
            return true
        }

        return false
    }

    /**
     * Can this member still register in a new group or waiting list?
     */
    canRegister(groups: Group[]) {
        // todo: atm it is not possible to register a member in multiple groups
        if (this.hasActiveRegistrations()) {
            return false
        }

        if (!this.details) {
            // we have no clue!
            return true
        }

        const availableGroups = this.details.getMatchingGroups(groups).filter(g => !this.groups.find(gg => gg.id == g.id)).filter(g => !this.waitingGroups.find(gg => gg.id == g.id))
        return availableGroups.length > 0
    }


    /**
     * Return if all information is complete and valid
     */
    isComplete(forWaitingList = false) {
        if (!this.details) {
            return false
        }

        // this is the spot where we can validate if a member is still valid for registration, e.g. when he has aged and now has to fill in his/her phone number

        if (forWaitingList) {
            // todo: still do some minor validation
            return true
        }

        return this.details.lastReviewed !== null && this.details.lastReviewed > new Date(new Date().getTime() - 1000*60*60*24*60)
    }

    /**
     * Return a list of the groups that this user might register in + if it will be on the waiting list or if we should ask
     */
    getSelectableGroups(groups: Group[]): SelectableGroup[] {
        if (this.activeRegistrations.find(r => !r.waitingList)) {
            return []
        }

        if (!this.details) {
            return []
        }

        const availableGroups = this.details.getMatchingGroups(groups)//.filter(g => !this.groups.find(gg => gg.id == g.id)).filter(g => !this.waitingGroups.find(gg => gg.id == g.id))
        const selectableGroups: SelectableGroup[] = []
        for (const group of availableGroups) {
            let skipReason: WaitingListSkipReason | null = null

            if (this.acceptedWaitingGroups.find(g => g.id == group.id)) {
                // not waiting list
                skipReason = WaitingListSkipReason.Invitation
            } else {
                if (group.shouldKnowExisting() && !this.details.existingStatus) {
                    // Do not announce waiting list yet
                    skipReason = WaitingListSkipReason.None
                } else {
                    skipReason = group.canSkipWaitingList(this.details.existingStatus)
                }
            }
          
            const selectable = new SelectableGroup(group, skipReason, skipReason != WaitingListSkipReason.Invitation && (!this.details.existingStatus || this.details.existingStatus.isExpired()) && group.shouldKnowExisting())
            
            if (this.groups.find(gg => gg.id == group.id)) {
                selectable.alreadyRegistered = true;
            }

            if (this.waitingGroups.find(gg => gg.id == group.id)) {
                selectable.alreadyOnWaitingList = true;
            }

            selectableGroups.push(selectable)
        }
        return selectableGroups

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