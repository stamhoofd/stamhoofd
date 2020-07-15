import { column,Model, OneToManyRelation } from '@simonbackx/simple-database';
import { v4 as uuidv4 } from "uuid";

import { Registration } from './Registration';

export class Member extends Model {
    static table = "members"

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    organizationId: string;

    @column({ type: "string", nullable: true })
    encryptedForOrganization: string | null = null;

    @column({ type: "string", nullable: true })
    encryptedForMember: string | null = null;

    /**
    * Public key used for encryption
    */
    @column({ type: "string" })
    publicKey: string;

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
        }
    })
    updatedAt: Date

    static registrations = new OneToManyRelation(Member, Registration, "registrations", "memberId")
}