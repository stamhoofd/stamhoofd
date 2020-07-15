import { column, Database, ManyToManyRelation,ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { Sodium } from '@stamhoofd/crypto';
import { KeyConstants, Permissions } from "@stamhoofd/structures"
import { v4 as uuidv4 } from "uuid";

import { Member, MemberWithRegistrations } from './Member';
import { Organization } from "./Organization";
import { Payment } from './Payment';
import { Registration, RegistrationWithPayment } from './Registration';

export type UserWithOrganization = User & { organization: Organization };
export type UserForAuthentication = User & { publicAuthSignKey: string; authSignKeyConstants: KeyConstants };
export type UserFull = User & { publicAuthSignKey: string; authEncryptionKeyConstants: KeyConstants; authSignKeyConstants: KeyConstants; encryptedPrivateKey: string };

export class User extends Model {
    static table = "users";

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ foreignKey: User.organization, type: "string" })
    organizationId: string;

    @column({ type: "string" })
    email: string;

    @column({ type: "boolean" })
    verified: boolean;

    /**
     * Public key used for encryption
     */
    @column({ type: "string" })
    publicKey: string;

    /**
     * Public key used for encryption
     */
    @column({ type: "json", decoder: Permissions, nullable: true })
    permissions: Permissions | null = null

    /**
     * public key that is used to verify during login (using a challenge) and for getting a token
     */
    @column({ type: "string" })
    protected publicAuthSignKey?: string

    /**
     * Encrypted private key, used for authenticated encrytion and decryption
     */
    @column({ type: "string", nullable: true })
    protected encryptedPrivateKey: string | null = null

    /**
     * Constants that are used to get the authSignKeyPair from the user password. Using
     */
    @column({ type: "json", decoder: KeyConstants })
    protected authSignKeyConstants?: KeyConstants

    /**
     * Constants that are used to get the authEncryptionKey from the user password. Only accessible for the user using his token (= after login)
     */
    @column({ type: "json", decoder: KeyConstants, nullable: true })
    protected authEncryptionKeyConstants: KeyConstants | null = null


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

    static organization = new ManyToOneRelation(Organization, "organization");

    // Members that were added by this user
    static members = new ManyToManyRelation(User, Member, "members");

    /**
     * @param namespace
     * @override@override@override@override@override
     */
    static getDefaultSelect(namespace?: string): string {
        return this.selectColumnsWithout(namespace, "encryptedPrivateKey", "publicAuthSignKey", "authSignKeyConstants", "authEncryptionKeyConstants");
    }

    static async getFull(id: string): Promise<UserFull | undefined> {
        const [rows] = await Database.select(`SELECT * FROM ${this.table} WHERE \`id\` = ? LIMIT 1`, [id]);

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        return this.fromRow(rows[0][this.table]) as UserFull;
    }

    static async getForAuthentication(organizationId: string, email: string): Promise<UserForAuthentication | undefined> {
        const [rows] = await Database.select(`SELECT * FROM ${this.table} WHERE \`email\` = ? AND organizationId = ? LIMIT 1`, [email, organizationId]);

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        return this.fromRow(rows[0][this.table]) as UserForAuthentication;
    }

    // Methods
    /*static async login(
        organization: Organization,
        email: string,
        password: string
    ): Promise<UserWithOrganization | undefined> {
        const [
            rows,
        ] = await Database.select(`SELECT * FROM ${this.table} WHERE organizationId = ? AND email = ? LIMIT 1`, [
            organization.id,
            email,
        ]);

        if (rows.length == 0) {
            // todo: check timing attack?
            return;
        }

        // Read member + address from first row
        const user = this.fromRow(rows[0][this.table]);

        if (!user?.password) {
            return;
        }

        if (await argon2.verify(user.password, password)) {
            user.eraseProperty("password");
            return user.setRelation(User.organization, organization);
        }
    }*/

    static async register(
        organization: Organization,
        email: string,
        publicKey: string,
        publicAuthSignKey: string,
        encryptedPrivateKey: string,
        authSignKeyConstants: KeyConstants,
        authEncryptionKeyConstants: KeyConstants,
        id?: string
    ): Promise<UserWithOrganization | undefined> {
        const user = new User().setRelation(User.organization, organization);
        user.id = id ?? uuidv4()
        user.email = email;
        user.publicKey = publicKey;
        user.publicAuthSignKey = publicAuthSignKey
        user.encryptedPrivateKey = encryptedPrivateKey
        user.authSignKeyConstants = authSignKeyConstants
        user.authEncryptionKeyConstants = authEncryptionKeyConstants
        user.verified = false;

        try {
            await user.save();
        } catch (e) {
            // Duplicate key probably
            if (e.code && e.code == "ER_DUP_ENTRY") {
                return;
            }
            throw e;
        }

        // Remove from memory and avoid accidental leaking
        user.eraseProperty("publicAuthSignKey");
        user.eraseProperty("encryptedPrivateKey");
        user.eraseProperty("authSignKeyConstants");
        user.eraseProperty("authEncryptionKeyConstants");
        return user;
    }

    getAuthSignKeyConstants(this: UserForAuthentication): KeyConstants {
        return this.authSignKeyConstants
    }

    async verifyAuthSignature(this: UserForAuthentication, signature: string, message: string) {
        return await Sodium.verifySignature(signature, message, this.publicAuthSignKey)
    }

    /**
     * Fetch all members with their corresponding (valid) registrations and payment
     */
    async getMembersWithRegistration(): Promise<MemberWithRegistrations[]> {
        let query = `SELECT ${Member.getDefaultSelect()}, ${Registration.getDefaultSelect()}, ${Payment.getDefaultSelect()} from \`${User.members.linkTable}\`\n`;
        query += `JOIN \`${Member.table}\` ON \`${Member.table}\`.\`${Member.primary.name}\` = \`${User.members.linkTable}\`.\`${User.members.linkKeyB}\`\n`
        query += `LEFT JOIN \`${Registration.table}\` ON \`${Registration.table}\`.\`${Member.registrations.foreignKey}\` = \`${Member.table}\`.\`${Member.primary.name}\` AND \`${Registration.table}\`.\`registeredAt\` is not null\n`
        query += `LEFT JOIN \`${Payment.table}\` ON \`${Payment.table}\`.\`${Payment.primary.name}\` = \`${Registration.table}\`.\`${Registration.payment.foreignKey}\`\n`

        query += `where \`${User.members.linkTable}\`.\`${User.members.linkKeyA}\` = ?`

        const [results] = await Database.select(query, [this.id])
        const members: MemberWithRegistrations[] = []

        for (const row of results) {
            const foundMember = Member.fromRow(row[Member.table])
            if (!foundMember) {
                throw new Error("Expected member in every row")
            }
            const _f = foundMember.setManyRelation(Member.registrations, []) as MemberWithRegistrations

            // Seach if we already got this member?
            const existingMember = members.find(m => m.id == _f.id)

            const member: MemberWithRegistrations = (existingMember ?? _f)
            if (!existingMember) {
                members.push(member)
            }

            // Check if we have a registration with a payment
            const registration = Registration.fromRow(row[Registration.table])
            if (registration) {
                const payment = Payment.fromRow(row[Payment.table])
                if (!payment) {
                    throw new Error("Every registration should have a valid payment")
                }

                const regWithPayment: RegistrationWithPayment = registration.setRelation(Registration.payment, payment)
                member.registrations.push(regWithPayment)
            }
        }

        return members

    }
}
