import { AutoEncoder, DateDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';

/**
 * Invitation to register for a group. If an invitation exists the member can always register even if he does not meet the requirements of the group.
 * Used for allowing members who are on a waiting list to register for a group.
 */
export class RegistrationInvitation extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    groupId: string;

    @field({ decoder: StringDecoder })
    memberId: string;

    @field({ decoder: StringDecoder })
    organizationId: string;

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date();

    /**
     * The member will be removed from the waiting list with this id, if this property is not null, when he is registered for the group he was invited for.
     */
    @field({decoder: StringDecoder, nullable: true})
    autoRemoveFromWaitingListWithId: string | null = null;
}
