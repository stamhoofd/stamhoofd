import { ArrayDecoder,AutoEncoder, DateDecoder,field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { InviteUserDetails } from './InviteUserDetails';
import { Permissions } from './Permissions';
import { User } from './User';

/**
 * Create an invitation
 */
export class NewInvite extends AutoEncoder {
    /**
     * ID of the user that will receive this invitation. Login will be required to open the invitation. Can only be used by organization admins.
     */
    @field({ decoder: StringDecoder, nullable: true })
    receiverId: string | null = null

    /**
     * Contains the encrypted keychain items that can get created when the invite is accepted
     */
    @field({ decoder: StringDecoder, nullable: true })
    keychainItems: string | null = null

    /**
     * Give permissions to members. Only allowed to give permissions to members as an admin with full access to the group of that member or as a normal user that already has access to that member.
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true })
    memberIds: string[] | null = null

    /**
     * Only admins with full permission can create invites that include permissions
     */
    @field({ decoder: Permissions, nullable: true })
    permissions: Permissions | null = null

    @field({ decoder: InviteUserDetails, nullable: true })
    userDetails: InviteUserDetails | null = null
}

/**
 * Receive an existing invitation. Does not include the encrypted data and/or key, that is only send when trading in the invite for the keychainItems (for automatic invalidation / one user only).
 */
export class Invite extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Key that will get used in the invitation
     */
    @field({ decoder: StringDecoder })
    key: string

    @field({ decoder: User, nullable: true })
    receiver: User | null = null

    @field({ decoder: User})
    sender: User

    /**
     * Give permissions to members. Only allowed to give permissions to members as an admin with full access to the group of that member or as a normal user that already has access to that member.
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true })
    memberIds: string[] | null = null

    /**
     * Only admins with full permission can create invites that include permissions
     */
    @field({ decoder: Permissions, nullable: true })
    permissions: Permissions | null = null

    @field({ decoder: InviteUserDetails, nullable: true })
    userDetails: InviteUserDetails | null = null

    /**
     * An invite can still be requested when it is expired, but the user won't be able to trade it in. This is to allow a usefull error page that informs the user that the link is expired and that he/she might be able to request a new key.
     */
    @field({ decoder: DateDecoder })
    validUntil: Date
}