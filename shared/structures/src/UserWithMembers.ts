import { field } from '@simonbackx/simple-encoding';
import { MembersBlob } from "./members/MemberWithRegistrationsBlob";
import { User } from "./User";

export class UserWithMembers extends User {
    @field({ decoder: MembersBlob})
    members: MembersBlob = MembersBlob.create({})
}
