import { field } from '@simonbackx/simple-encoding';
import { ImpersonatedBy } from './Impersonation.js';
import { MembersBlob } from './members/MemberWithRegistrationsBlob.js';
import { User } from './User.js';

export class UserWithMembers extends User {
    @field({ decoder: MembersBlob })
    members: MembersBlob = MembersBlob.create({});

    /**
     * Only set on the user of the current session, and only when that session is
     * impersonating: this user is the one being viewed, the account below is the one
     * actually acting.
     */
    @field({ decoder: ImpersonatedBy, nullable: true, ...NextVersion })
    impersonatedBy: ImpersonatedBy | null = null;
}
