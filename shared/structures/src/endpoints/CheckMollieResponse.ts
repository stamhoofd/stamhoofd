import { ArrayDecoder,AutoEncoder, field } from "@simonbackx/simple-encoding"

import { Organization } from "../Organization"
import { MollieProfile } from "../OrganizationPrivateMetaData"

export class CheckMollieResponse extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(MollieProfile) })
    profiles: MollieProfile[] = []

    @field({ decoder: Organization })
    organization: Organization
}