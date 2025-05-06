import { ArrayDecoder, field } from '@simonbackx/simple-encoding';

import { MemberPlatformMembershipHelper } from '../helpers/MemberPlatformMembershipHelper.js';
import { User } from '../User.js';
import { Member } from './Member.js';
import { MemberPlatformMembership } from './MemberPlatformMembership.js';
import { MemberResponsibilityRecord } from './MemberResponsibilityRecord.js';
import { Registration } from './Registration.js';

export class RegistrationWithMember extends Registration {
    @field({ decoder: Member })
    member: Member;

    @field({ decoder: new ArrayDecoder(MemberResponsibilityRecord), version: 263 })
    responsibilities: MemberResponsibilityRecord[] = [];

    @field({ decoder: new ArrayDecoder(MemberPlatformMembership), version: 270 })
    platformMemberships: MemberPlatformMembership[] = [];

    @field({ decoder: new ArrayDecoder(User), version: 32 })
    users: User[] = [];

    get membershipStatus() {
        return MemberPlatformMembershipHelper.getStatus(this.platformMemberships);
    }

    get hasFutureMembership() {
        return MemberPlatformMembershipHelper.hasFutureMembership(this.platformMemberships);
    }

    static from(registration: Registration, member: Member, responsibilities: MemberResponsibilityRecord[], platformMemberships: MemberPlatformMembership[]) {
        return RegistrationWithMember.create({
            ...registration,
            member,
            responsibilities,
            platformMemberships,
        });
    }

    getContinuousMembershipStatus({ start, end }: { start: Date; end: Date }) {
        return MemberPlatformMembershipHelper.getContinuousMembershipStatus({ memberships: this.platformMemberships, start, end });
    }
}
