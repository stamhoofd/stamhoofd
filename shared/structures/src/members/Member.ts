import { AutoEncoder, DateDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';

import { MemberDetails } from './MemberDetails.js';

export class TinyMember extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    firstName = '';

    @field({ decoder: StringDecoder })
    lastName = '';

    get name() {
        if (!this.firstName) {
            return this.lastName;
        }
        if (!this.lastName) {
            return this.firstName;
        }
        return this.firstName + ' ' + this.lastName;
    }
}

export class Member extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: MemberDetails, field: 'nonEncryptedDetails' })
    @field({ decoder: MemberDetails, version: 165 })
    details: MemberDetails;

    /**
     * @deprecated
     */
    @field({ decoder: IntegerDecoder, optional: true })
    outstandingBalance = 0;

    @field({ decoder: DateDecoder, version: 31 })
    createdAt: Date = new Date();

    @field({ decoder: DateDecoder, version: 31 })
    updatedAt: Date = new Date();

    get tiny() {
        return TinyMember.create({
            id: this.id,
            firstName: this.details.firstName,
            lastName: this.details.lastName,
        });
    }

    get isMinor() {
        return (this.details.age !== null && this.details.age < 18);
    }

    get lastName() {
        return this.details.lastName;
    }

    get firstName() {
        return this.details.firstName;
    }

    get name() {
        return this.details.name;
    }

    static sorterByName(sortDirection = 'ASC') {
        return (a: Member, b: Member) => {
            if (!a.details && !b.details) {
                return 0;
            }
            if (!a.details) {
                return 1;
            }
            if (!b.details) {
                return -1;
            }

            if (sortDirection == 'ASC') {
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
        };
    }
}
