import { AutoEncoder, field, IntegerDecoder,StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { GroupCategory } from './GroupCategory';
import { GroupPrivateSettings } from './GroupPrivateSettings';
import { GroupSettings, WaitingListType } from './GroupSettings';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Permissions } from './Permissions';

export class Group extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: IntegerDecoder })
    cycle = 0

    @field({ decoder: GroupSettings })
    settings: GroupSettings

    /**
     * Only set when you have access to this information
     */
    @field({ decoder: GroupPrivateSettings, nullable: true, version: 10 })
    privateSettings: GroupPrivateSettings | null = null

    static defaultSort(this: unknown, a: Group, b: Group) {
        if (a.settings.maxAge && !b.settings.maxAge) {
            return -1
        }
        if (b.settings.maxAge && !a.settings.maxAge) {
            return 1
        }
        if (!b.settings.maxAge && !a.settings.maxAge) {
            // name
            return Group.nameSort(a, b)
        }
        if (a.settings.maxAge! > b.settings.maxAge!) {
            return 1
        }
        if (a.settings.maxAge! < b.settings.maxAge!) {
            return -1
        }
        return Group.nameSort(a, b)
    }

    static nameSort(this: unknown, a: Group, b: Group) {
        if (a.settings.name.toLowerCase() < b.settings.name.toLowerCase()) {
            return -1
        }
        if (a.settings.name.toLowerCase() > b.settings.name.toLowerCase()) {
            return 1
        }
        return 0
    }

    /**
     * Return the pre registration date only if is is active right now
     */
    get activePreRegistrationDate() {
        if (this.settings.registrationStartDate < new Date() || this.settings.waitingListType !== WaitingListType.PreRegistrations) {
            // Start date is in the past: registrations are open
            return null
        }
        return this.settings.preRegistrationsDate
    }

    get notYetOpen() {
        const now = new Date()
        const preRegistrationDate = this.activePreRegistrationDate

        if (this.settings.registrationStartDate > now && (!preRegistrationDate || preRegistrationDate > now)) {
            // Start date or pre registration date are in the future

            return true
        }

        return false
    }

    /**
     * No registrations and waiting list registrations are possible if closed
     */
    get closed() {
        if (this.notYetOpen) {
            // Start date or pre registration date are in the future
            return true
        }

        const now = new Date()
        if (this.settings.registrationEndDate < now) {
            return true
        }
        
        return false
    }

    hasWaitingList(): boolean {
        return this.settings.waitingListType !== WaitingListType.None
    }

    /**
     * Returns all parent and grandparents of this group
     */
    getParentCategories(all: GroupCategory[]): GroupCategory[] {
        const map = new Map<string, GroupCategory>()
        
        const parents = all.filter(g => g.groupIds.includes(this.id))
        for (const parent of parents) {
            map.set(parent.id, parent)

            const hisParents = parent.getParentCategories(all)
            for (const pp of hisParents) {
                 map.set(pp.id, pp)
            }
        }

        return [...map.values()]
    }

    /**
     * Whetever a given user has access to the members in this group. 
     */
    canViewMembers(permissions: Permissions): boolean {
        if (permissions.hasReadAccess()) {
            return true
        }

        if (!this.privateSettings) {
            return false
        }

        // Check roles
        for (const role of this.privateSettings.permissions.read) {
            if (permissions.roles.find(r => r.id === role.id)) {
                return true
            }
        }

        return this.canEditMembers(permissions)
    }

    /**
     * Whetever a given user has access to the members in this group. 
     */
    canEditMembers(permissions: Permissions): boolean {
        if (permissions.hasWriteAccess()) {
            return true
        }

        if (!this.privateSettings) {
            return false
        }

        // Check roles
        for (const role of this.privateSettings.permissions.write) {
            if (permissions.roles.find(r => r.id === role.id)) {
                return true
            }
        }

        return this.canEditSettings(permissions)
    }

    /**
     * Whetever a given user has access to the members in this group. 
     */
    canEditSettings(permissions: Permissions): boolean {
        if (permissions.hasFullAccess()) {
            return true
        }

        if (!this.privateSettings) {
            return false
        }

        // Check roles
        for (const role of this.privateSettings.permissions.full) {
            if (permissions.roles.find(r => r.id === role.id)) {
                return true
            }
        }

        return false
    }

}

export const GroupPatch = Group.patchType()