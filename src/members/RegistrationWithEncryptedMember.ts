import { field } from "@simonbackx/simple-encoding"

import { EncryptedMember } from "./EncryptedMember"
import { Registration } from "./Registration"

export class RegistrationWithEncryptedMember extends Registration {
    @field({ decoder: EncryptedMember })
    member: EncryptedMember
}