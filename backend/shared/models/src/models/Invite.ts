import { column, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { ArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { InviteUserDetails,Permissions } from "@stamhoofd/structures"
import { v4 as uuidv4 } from "uuid";

import { Organization } from "./Organization";
import { User } from './User';

export class Invite extends Model {
    static table = "invites";

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ foreignKey: Invite.organization, type: "string" })
    organizationId: string;

    @column({ foreignKey: Invite.sender, type: "string" })
    senderId: string;

    @column({ type: "string", nullable: true })
    receiverId: string | null = null;

    /**
    * List of memberIds this user should get access to
    */
    @column({ type: "json", decoder: new ArrayDecoder(StringDecoder), nullable: true })
    memberIds: string[] | null = null

    /**
    * Set if you want to give admin permissions to this user. Backend should check if sender still has admin permission on the date of activation of this invite.
    */
    @column({ type: "json", decoder: Permissions, nullable: true })
    permissions: Permissions | null = null

    /**
    * Default user details + identification of invite if no receiver is set
    */
    @column({ type: "json", decoder: InviteUserDetails, nullable: true })
    userDetails: InviteUserDetails | null = null


    @column({ type: "string" })
    key: string;

    @column({ type: "string", nullable: true  })
    keychainItems: string | null = null;

    @column({
        type: "datetime", beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }

            // 4 hours valid
            const date = new Date(new Date().getTime() + 4*1000*60*60)
            date.setMilliseconds(0)
            return date
        }
    })
    validUntil: Date

    @column({
        type: "datetime", beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date()
            date.setMilliseconds(0)
            return date
        }
    })
    createdAt: Date

    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        },
        skipUpdate: true
    })
    updatedAt: Date

    static organization = new ManyToOneRelation(Organization, "organization");
    static sender = new ManyToOneRelation(User, "sender");
}
