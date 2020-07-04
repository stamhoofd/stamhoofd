import { column, Database, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { EncryptedPrivateKeyBox } from "@stamhoofd/structures"
import argon2 from "argon2";
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

    @column({ type: "string" })
    email: string;

    @column({ type: "boolean" })
    verified: boolean;

    /**
     * Passwords will automatically get set to undefined if it was selected for login
     */
    @column({ type: "string" })
    protected password: string | undefined;

    /**
     * Passwords will automatically get set to undefined if it was selected for login
     */
    @column({ type: "json", decoder: EncryptedPrivateKeyBox, nullable: true })
    protected encryptedPrivateKey: EncryptedPrivateKeyBox | null = null

    /**
     * For now we only store one public key, but we might decide to allow the same user to have multiple keys.
     */
    @column({ type: "string" })
    publicKey: string;

    @column({ type: "datetime" })
    createdOn: Date;

    @column({ type: "datetime" })
    updatedOn: Date;

    @column({ foreignKey: User.organization, type: "string" })
    organizationId: string;

    static organization = new ManyToOneRelation(Organization, "organization");

    /**
     * @param namespace
     * @override@override@override@override@override
     */
    static getDefaultSelect(namespace?: string): string {
        return this.selectColumnsWithout(namespace, "password");
    }

    // Methods
    static async login(
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
    }

    static async register(
        organization: Organization,
        email: string,
        password: string,
        publicKey: string
    ): Promise<UserWithOrganization | undefined> {
        const user = new User().setRelation(User.organization, organization);
        user.email = email;
        const hash = await argon2.hash(password);
        user.password = hash;
        user.publicKey = publicKey;
        user.createdOn = new Date();
        user.createdOn.setMilliseconds(0);
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
        user.eraseProperty("password");
        return user;
    }
}
