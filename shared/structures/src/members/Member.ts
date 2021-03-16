import { AutoEncoder, BooleanDecoder,DateDecoder,field, StringDecoder } from '@simonbackx/simple-encoding';
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

    @field({ decoder: StringDecoder, version: 35 })
    organizationPublicKey: string

    @field({ decoder: DateDecoder, version: 31 })
    createdAt: Date = new Date()

    @field({ decoder: DateDecoder, version: 31 })
    updatedAt: Date = new Date()

    get name() {
        if (this.details) {
            return this.details.name
        }
        return this.firstName
    }


    static sorterByName(sortDirection = "ASC") {
        return (a, b) => {
            if (!a.details && !b.details) {
                return 0
            }
            if (!a.details) {
                return 1
            }
            if (!b.details) {
                return -1
            }

            if (sortDirection == "ASC") {
                if (a.details.name.toLowerCase() > b.details.name.toLowerCase()) {
                    return 1;
                }
                if (a.details.name.toLowerCase() < b.details.name.toLowerCase()) {
                    return -1;
                }
                return 0;
            }
            if (a.details.name.toLowerCase() > b.details.name.toLowerCase()) {
                return -1;
            }
            if (a.details.name.toLowerCase() < b.details.name.toLowerCase()) {
                return 1;
            }
            return 0;
        }
    }
}