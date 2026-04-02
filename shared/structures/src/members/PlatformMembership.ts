import { AutoEncoder, StringDecoder, field } from '@simonbackx/simple-encoding';
import { MemberPlatformMembership } from './MemberPlatformMembership.js';

export class PlatformMembershiMemberDetails extends AutoEncoder {
    @field({ decoder: StringDecoder })
    firstName = '';

    @field({ decoder: StringDecoder })
    lastName = '';

    @field({ decoder: StringDecoder, nullable: true })
    memberNumber: string | null;

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

export class PlatformMembershipOrganizationDetails extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder })
    uri = '';

}

export class PlatformMembership extends MemberPlatformMembership {
    @field({ decoder: PlatformMembershiMemberDetails })
    member: PlatformMembershiMemberDetails;

    @field({ decoder: PlatformMembershipOrganizationDetails })
    organization: PlatformMembershipOrganizationDetails;
}
