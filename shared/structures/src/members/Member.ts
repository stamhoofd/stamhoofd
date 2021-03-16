import { field } from '@simonbackx/simple-encoding';

import { EncryptedMember } from './EncryptedMember';
import { MemberDetails } from './MemberDetails';

export class Member extends EncryptedMember {
    @field({ decoder: MemberDetails })
    details: MemberDetails

    get name() {
        if (this.details) {
            return this.details.name
        }
        return this.firstName
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