import { AutoEncoder, field, IntegerDecoder,StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { GroupPrivateSettings } from './GroupPrivateSettings';
import { GroupSettings, WaitingListType } from './GroupSettings';

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
        if (this.settings.waitingListType !== WaitingListType.PreRegistrations) {
            return null
        }
        if (this.settings.startDate < new Date()) {
            // Start date is in the past: registrations are open
            return null
        }
        return this.settings.startDate
    }
}

export const GroupPatch = Group.patchType()