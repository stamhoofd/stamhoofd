import { Model } from "@stamhoofd/backend/src/database/classes/Model";
import { column } from "@stamhoofd/backend/src/database/decorators/Column";
import { Database } from "@stamhoofd/backend/src/database/classes/Database";
import { Organization } from "@stamhoofd/backend/src/organizations/models/Organization";
import { ManyToOneRelation } from "@stamhoofd/backend/src/database/classes/ManyToOneRelation";
import argon2 from "argon2";

export type UserWithOrganization = User & { organization: Organization };

export class User extends Model {
    static table = "users";

    // Columns
    @column({ primary: true, type: "integer" })
    id: number | null = null;

    @column({ type: "string" })
    email: string;

    /**
     * Passwords will automatically get set to undefined if it was selected for login
     */
    @column({ type: "string" })
    protected password: string | undefined;

    /**
     * For now we only store one public key, but we might decide to allow the same user to have multiple keys.
     */
    @column({ type: "string" })
    publicKey: string;

    /**
     * Contains the signature of the user's publicKey with the secret of the organization. A public key should only get signed if it is a administrator of the organization.
     * It is used to derive trust from the organization to its administrators and add an extra layer of security that is only as strong as the security of how trust in the organization's public key is derived.
     * In case of a hostile server takeover, the hostile server will not be able to emulate administrators to get other administrators and users to encrypt keys, as long as it is not able to get the user to trust its new key.
     * Administrators with 'create user'-permission have access to the organization's secret and can sign other users. They are the only users that can give the 'create-user' permission to other users
     */
    @column({ type: "string", nullable: true })
    adminSignature: string | null = null;

    @column({ type: "datetime" })
    createdOn: Date;

    @column({ type: "datetime" })
    updatedOn: Date;

    @column({ foreignKey: User.organization, type: "integer" })
    organizationId: number;

    static organization = new ManyToOneRelation(Organization, "organization");

    /**
     * @param namespace
     * @override@override@override@override@override
     */
    static getDefaultSelect(namespace?: string): string {
        return this.selectColumnsWithout(namespace, "password");
    }

    // Methods
    static async getByID(id: number): Promise<User | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()} FROM ${this.table} WHERE ${this.primary.name} = ? LIMIT 1`,
            [id]
        );

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        return this.fromRow(rows[0][this.table]);
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
