import { AnyDecoder, ArrayDecoder, AutoEncoder, DateDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { MemberDetails } from './MemberDetails';

export class Member extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * @deprecated Marked for removal
     * Slowly migrate towards a non-encrypted member in the future
     */
    @field({ decoder: StringDecoder, optional: true, field: 'firstName' })
    @field({ decoder: StringDecoder, optional: true, version: 165 })
    _f = ""

    /**
     * @deprecated Marked for removal
     * Slowly migrate towards a non-encrypted member in the future
     */
    @field({ decoder: new ArrayDecoder(AnyDecoder), optional: true, field: 'encryptedDetails' })
    @field({ decoder: new ArrayDecoder(AnyDecoder), optional: true, version: 165 })
    _ed = []

    @field({ decoder: MemberDetails, field: 'nonEncryptedDetails' })
    @field({ decoder: MemberDetails, version: 165 })
    details: MemberDetails

    @field({ decoder: DateDecoder, version: 31 })
    createdAt: Date = new Date()

    @field({ decoder: DateDecoder, version: 31 })
    updatedAt: Date = new Date()

    get isMinor() {
        return (this.details.age !== null && this.details.age < 18)
    }

    get firstName() {
        return this.details.firstName
    }

    get name() {
        return this.details.name
    }

    static sorterByName(sortDirection = "ASC") {
        return (a: Member, b: Member) => {
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