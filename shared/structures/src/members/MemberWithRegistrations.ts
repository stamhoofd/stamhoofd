import { ArrayDecoder, field } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';

import { Group } from '../Group';
import { GroupCategory } from '../GroupCategory';
import { WaitingListSkipReason, WaitingListType } from '../GroupSettings';
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

    get isNew(): boolean {
        return this.inactiveRegistrations.length === 0
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
    }
    
    get paid(): boolean {
        return !this.activeRegistrations.find(r => r.payment && r.payment.status != PaymentStatus.Succeeded)
    }

    get info(): string {
        return this.paid ? "" : "Lidgeld nog niet betaald";
    }

    canSkipWaitingList(group: Group, family: MemberWithRegistrations[]): boolean  {
        switch (group.settings.waitingListType) {
            case WaitingListType.None: return true
            case WaitingListType.ExistingMembersFirst: {
                if (!this.isNew) {
                    return true
                }

                if (group.settings.priorityForFamily) {
                    for (const f of family) {
                        if (!f.isNew) {
                            return true
                        }
                    }
                }

                return false
            }
            case WaitingListType.All: return false;
            case WaitingListType.PreRegistrations: return false;
        }
    }

    /**
     * @deprecated
     * Return an instance of SelectedGroup if this group is selected (and still selectable) (contains information about whether it is selected for the waiting list or not)
     */
    getSelectedGroup(group: Group): SelectedGroup | null {
        return null;
    }

    /**
     * @deprecated
     * Return the groups that are currently selected for registration, optionally filter by waitingList
     */
    getSelectedGroups(groups: Group[]): SelectedGroup[] {
        return []
    }

    /**
     * @deprecated
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

    /**
     * @deprecated
     */
    isCompleteForSelectedGroups(groups: Group[]): boolean {
        return false
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
     * @deprecated
     * Return a list of the groups that this user might register in + if it will be on the waiting list or if we should ask
     */
    getSelectableGroups(groups: Group[]): SelectableGroup[] {
        return []

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