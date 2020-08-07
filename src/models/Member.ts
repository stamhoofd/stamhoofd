import { column,Model, OneToManyRelation } from '@simonbackx/simple-database';
import { EncryptedMember, EncryptedMemberWithRegistrations, RegistrationWithEncryptedMember } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

import { Registration, RegistrationWithPayment } from './Registration';
export type MemberWithRegistrations = Member & { registrations: RegistrationWithPayment[] }

// Defined here to prevent cycles
export type RegistrationWithMember = Registration & { member: Member }

export class Member extends Model {
    static table = "members"

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    /**
     * Firstname of this member. This is needed when the password is lost, when the member receives an invite etc. This is the only field that is not stored end-to-end encrypted.
     * It has been a trade off to keep the system accessible for all users and make the 'password forgot' method not impossibly hard to recover from for non technical users.
     * It is also needed when the users receives an invite to manage a user without receiving the private key. (in the case the organization added the user manually, and when they send invites)
     * Additionally, in most e-mails the firstName will get used anyway, so let's not pretend that is is end-to-end encrypted.
     * It also makes it possible to provide automated e-mails from the server during registration, e.g. "Simon has been registered succesfully!" or "We received the payment for the registration of Simon"
     * We might consider an option to make this field optional in the future for e.g. religious or political organizations or other organizations where the members should be kept secret.
     */
    @column({ type: "string" })
    firstName: string;

    @column({ type: "string" })
    organizationId: string;

    @column({ type: "string", nullable: true })
    encryptedForOrganization: string | null = null;

    @column({ type: "string", nullable: true })
    encryptedForMember: string | null = null;

    /**
     * Set to true for members who did not confirm their membership.
     * E.g. when the member is imported from last year. 
     * 
     * If a new member creates an account with the same firstName, lastName and birthDay, it will get merged (except the memberDetails).
     * This merging behaviour happens in the dashboard in the front-end, not on the server.
     */
    @column({ type: "boolean" })
    placeholder = false;

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

    getStructureWithRegistrations(this: MemberWithRegistrations) {
        return EncryptedMemberWithRegistrations.create(
            Object.assign(Object.assign({}, this), {
                registrations: this.registrations.map(r => r.getStructure())
            })
        )
    }

    static getRegistrationWithMemberStructure(registration: RegistrationWithMember) {
        return RegistrationWithEncryptedMember.create({
            id: registration.id,
            groupId: registration.groupId,
            cycle: registration.cycle,
            registeredAt: registration.registeredAt,
            deactivatedAt: registration.deactivatedAt,
            createdAt: registration.createdAt,
            updatedAt: registration.updatedAt,
            member: EncryptedMember.create(registration.member),
            waitingList: registration.waitingList,
        })
    }
}