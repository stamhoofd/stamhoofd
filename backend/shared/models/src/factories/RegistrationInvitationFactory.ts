import { Factory } from '@simonbackx/simple-database';

import type { Group } from '../models/Group.js';
import type { Member } from '../models/Member.js';
import type { Organization } from '../models/Organization.js';
import { RegistrationInvitation } from '../models/RegistrationInvitation.js';

class Options {
    group: Group;
    member: Member;
    organization: Organization
}

export class RegistrationInvitationFactory extends Factory<Options, RegistrationInvitation> {
    async create(): Promise<RegistrationInvitation> {
        const invitation = new RegistrationInvitation();
        invitation.groupId = this.options.group.id;
        invitation.memberId = this.options.member.id;
        invitation.organizationId = this.options.organization.id;
        await invitation.save();

        return invitation;
    }
}
