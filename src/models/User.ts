import { column, Database, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { KeyConstants } from "@stamhoofd/structures"
import { v4 as uuidv4 } from "uuid";

import { Organization } from "./Organization";

export type UserWithOrganization = User & { organization: Organization };

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
     * public key that is used to verify during login (using a challenge) and for getting a token
     */
    @column({ type: "string", nullable: true })
    protected publicAuthSignKey: string | null = null

    /**
     * Encrypted private key, used for authenticated encrytion and decryption
     */
    @column({ type: "string", nullable: true })
    protected encryptedPrivateKey: string | null = null

    /**
     * Constants that are used to get the authSignKeyPair from the user password. Using
     */
    @column({ type: "json", decoder: KeyConstants, nullable: true })
    protected authSignKeyConstants: KeyConstants | null = null

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

    /**
     * @param namespace
     * @override@override@override@override@override
     */
    static getDefaultSelect(namespace?: string): string {
        return this.selectColumnsWithout(namespace, "encryptedPrivateKey", "publicAuthSignKey", "authSignKeyConstants", "authEncryptionKeyConstants");
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
        authEncryptionKeyConstants: KeyConstants
    ): Promise<UserWithOrganization | undefined> {
        const user = new User().setRelation(User.organization, organization);
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
}
