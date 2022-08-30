import { column,Database,ManyToOneRelation,Model } from '@simonbackx/simple-database';
import { getPermissionLevelNumber, MemberWithRegistrations, Payment as PaymentStructure, PermissionLevel, Registration as RegistrationStructure, Replacement } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

import { Payment } from './Payment';
import { User } from './User';

export class Registration extends Model {
    static table = "registrations"

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    memberId: string;

    @column({ type: "string" })
    groupId: string;

    /**
     * @deprecated
     */
    @column({ type: "string", nullable: true })
    paymentId: string | null = null

    @column({ type: "integer" })
    cycle: number;

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

    @column({ type: "datetime", nullable: true })
    registeredAt: Date | null = null

    @column({ type: "datetime", nullable: true })
    reservedUntil: Date | null = null

    @column({ type: "boolean" })
    waitingList = false

    /**
     * When a registration is on the waiting list or is invite only, set this to true to allow the user to
     * register normally.
     */
    @column({ type: "boolean" })
    canRegister = false

    @column({ type: "datetime", nullable: true})
    deactivatedAt: Date | null = null

    /*@column({ type: "integer", nullable: true})
    cachedPrice: number | null = null

    @column({ type: "integer", nullable: true})
    cachedPricePaid: number | null = null*/

    getStructure() {
        return RegistrationStructure.create(this)
    }

    hasAccess(user: User, groups: import('./Group').Group[], permissionLevel: PermissionLevel) {
        if (!user.permissions) {
            return false
        }

        const group = groups.find(g => g.id === this.groupId)
        if (!group) {
            return false;
        }

        if (getPermissionLevelNumber(group.privateSettings.permissions.getPermissionLevel(user.permissions)) >= getPermissionLevelNumber(permissionLevel)) {
            return true;
        }

        return false;
    }

    hasReadAccess(user: User, groups: import('./Group').Group[]) {
        return this.hasAccess(user, groups, PermissionLevel.Read)
    }

    hasWriteAccess(user: User, groups: import('./Group').Group[]) {
        return this.hasAccess(user, groups, PermissionLevel.Write)
    }

    /**
     * Get the number of active members that are currently registered
     * This is used for billing
     */
    static async getActiveMembers(organizationId: string): Promise<number> {
        const query = `
        SELECT COUNT(DISTINCT \`${Registration.table}\`.memberId) as c FROM \`${Registration.table}\` 
        JOIN \`groups\` ON \`groups\`.id = \`${Registration.table}\`.groupId
        WHERE \`groups\`.organizationId = ? AND \`${Registration.table}\`.cycle = \`groups\`.cycle AND \`${Registration.table}\`.registeredAt is not null AND \`${Registration.table}\`.waitingList = 0`
        
        const [results] = await Database.select(query, [organizationId])
        const count = results[0]['']['c'];

        if (Number.isInteger(count)) {
           return count
        } else {
            console.error("Unexpected result for occupancy", results)
            throw new Error("Query failed")
        }
    }

    sendConfirmationEmail(user: User, member: MemberWithRegistrations, payment: Payment | null) {
        // Send an e-mail to this user (only if verified)
        if (!user.verified) {
            return
        }

        // Get the template

        // Build all the magic variables needed for the template
        const replacements: Replacement[] = []

        // Send the e-mail
    }
}