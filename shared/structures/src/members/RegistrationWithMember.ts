import { field } from "@simonbackx/simple-encoding"

import { TinyMember } from './Member'
import { Registration } from "./Registration"

export class RegistrationWithMember extends Registration {
    @field({ decoder: TinyMember })
    member: TinyMember

    static from(registration: Registration, member: TinyMember) {
        return RegistrationWithMember.create({
            ...registration,
            member
        })
    }
}
