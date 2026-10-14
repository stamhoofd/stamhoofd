import type { Group } from '../Group.js';
import type { Organization } from '../Organization.js';
import type { PlatformMember } from '../members/PlatformMember.js';
import { RegisterItem } from '../members/checkout/RegisterItem.js';

export class PlatformMemberRegistrationHelper {
    static canRegister(member: PlatformMember, group: Group, organization: Organization) {
        return RegisterItem.defaultFor(member, group, organization).validationError === null;
    }

    static canRegisterForWaitingList(member: PlatformMember, group: Group, organization: Organization) {
        return RegisterItem.defaultFor(member, group, organization).validationErrorForWaitingList === null;
    }
}
