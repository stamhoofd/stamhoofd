import { field } from '@simonbackx/simple-encoding';
import { MembersBlob } from './members/MemberWithRegistrationsBlob.js';
import { User } from './User.js';

export class UserWithMembers extends User {
    @field({ decoder: MembersBlob })
    members: MembersBlob = MembersBlob.create({});
}
