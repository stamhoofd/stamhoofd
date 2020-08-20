import { AutoEncoder, BooleanDecoder,field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { MemberDetails } from './MemberDetails';

export class Member extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder, version: 20, upgrade: function(this: Member) {
        return this.details?.firstName ?? "Onbekend"
    } })
    firstName = ""

    @field({ decoder: MemberDetails, nullable: true })
    details: MemberDetails | null

    @field({ decoder: StringDecoder })
    publicKey: string

    @field({ decoder: BooleanDecoder, version: 20 })
    placeholder = false

    get name() {
        if (this.details) {
            return this.details.name
        }
        return this.firstName
    }
}