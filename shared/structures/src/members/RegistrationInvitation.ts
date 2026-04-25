import { AutoEncoder, DateDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { TranslatedString } from '../TranslatedString.js';
import { TinyMember } from './Member.js';

/**
 * Invitation to register for a group. If an invitation exists the member can always register even if he does not meet the requirements of the group.
 * Used for allowing members who are on a waiting list to register for a group.
 */
export class RegistrationInvitationRequest extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    groupId: string;

    @field({ decoder: StringDecoder })
    memberId: string;

    // For now every request should have a waitingListId
    @field({ decoder: StringDecoder })
    waitingListId: string;
}

/**
 * Invitation to register for a group. If an invitation exists the member can always register even if he does not meet the requirements of the group.
 * Used for allowing members who are on a waiting list to register for a group.
 */
export class RegistrationInvitation extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    groupId: string;

    @field(TranslatedString.field({}))
    groupName: TranslatedString;

    @field({ decoder: TinyMember })
    member: TinyMember;

    @field({ decoder: StringDecoder })
    organizationId: string;

    @field({ decoder: StringDecoder, nullable: true })
    waitingListId: string | null;

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date();
}

/**
 * Invitation to register for a group. If an invitation exists the member can always register even if he does not meet the requirements of the group.
 * Used for allowing members who are on a waiting list to register for a group.
 */
export class MemberRegistrationInvitation extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    groupId: string;

    @field(TranslatedString.field({}))
    groupName: TranslatedString;

    @field({ decoder: StringDecoder })
    organizationId: string;

    @field({ decoder: StringDecoder, nullable: true })
    waitingListId: string | null;

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date();
}
