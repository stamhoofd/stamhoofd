import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { GroupSettings } from './GroupSettings';

export class Group extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: GroupSettings })
    settings: GroupSettings

    static defaultSort(a: Group, b: Group) {
        if (a.settings.minBirthYear && !b.settings.minBirthYear) {
            return 1
        }
        if (b.settings.minBirthYear && !a.settings.minBirthYear) {
            return -1
        }
        if (!b.settings.minBirthYear && !a.settings.minBirthYear) {
            // name
            return Group.nameSort(a, b)
        }
        if (a.settings.minBirthYear! > b.settings.minBirthYear!) {
            return 1
        }
        if (a.settings.minBirthYear! < b.settings.minBirthYear!) {
            return -1
        }
        return Group.nameSort(a, b)
    }

    static nameSort(a: Group, b: Group) {
        if (a.settings.name.toLowerCase() < b.settings.name.toLowerCase()) {
            return 1
        }
        if (a.settings.name.toLowerCase() > b.settings.name.toLowerCase()) {
            return -1
        }
        return 0
    }
}

export const GroupPatch = Group.patchType()