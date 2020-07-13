import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { GroupSettings } from './GroupSettings';

export class Group extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: GroupSettings })
    settings: GroupSettings
}

export const GroupPatch = Group.patchType()