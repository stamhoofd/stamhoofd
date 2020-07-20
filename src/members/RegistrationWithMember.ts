import { field } from "@simonbackx/simple-encoding"

import { Group } from '../Group'
import { DecryptedMember } from "./DecryptedMember"
import { Registration } from "./Registration"

export class RegistrationWithMember extends Registration {
    @field({ decoder: DecryptedMember })
    member: DecryptedMember

    @field({ decoder: Group })
    group: Group
}