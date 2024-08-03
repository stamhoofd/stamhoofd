import { field } from "@simonbackx/simple-encoding"

import { Group } from '../Group'
import { Member } from './Member'
import { Registration } from "./Registration"

export class RegistrationWithMember extends Registration {
    @field({ decoder: Member })
    member: Member

    static from(registration: Registration, member: Member) {
        return RegistrationWithMember.create({
            ...registration,
            member
        })
    }
}
