import { field } from "@simonbackx/simple-encoding"

import { Group } from '../Group'
import { Organization } from "../Organization"
import { Member } from './Member'
import { Registration } from "./Registration"

export class RegistrationWithMember extends Registration {
    @field({ decoder: Member })
    member: Member

    @field({ decoder: Group })
    group: Group
}