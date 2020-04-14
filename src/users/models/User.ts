import { Model } from "@/database/classes/Model";
import { column } from "@/database/decorators/Column";
import { Database } from "@/database/classes/Database";
import { Organization } from '@/organizations/models/Organization';
import { ManyToOneRelation } from '@/database/classes/ManyToOneRelation';
import argon2 from "argon2";

export type UserWithOrganization = User & { organization: Organization }

export class User extends Model {
    static table = "users";

    // Columns
    @column({ primary: true, type: "integer" })
    id: number | null = null;

    @column({ type: "string" })
    email: string;

    // Password is never selected, unless a login has to happen
    @column({ type: "string" })
    protected password: string | undefined;

    @column({ type: "datetime" })
    createdOn: Date;

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
    static async login(organization: Organization, email: string, password: string): Promise<UserWithOrganization | undefined> {
        const [rows] = await Database.select(`SELECT * FROM ${this.table} WHERE organizationId = ? AND email = ? LIMIT 1`, [organization.id, email]);

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

    static async register(organization: Organization, email: string, password: string): Promise<UserWithOrganization | undefined> {
        const user = new User().setRelation(User.organization, organization);
        user.email = email;
        const hash = await argon2.hash(password);
        user.password = hash;
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
