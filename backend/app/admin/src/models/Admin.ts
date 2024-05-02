/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { column, Database, Model } from "@simonbackx/simple-database";
import argon2 from "argon2"
import { v4 as uuidv4 } from "uuid";
export type AdminFull = Admin & { password: string; };

export class Admin extends Model {
    static table = "admins";

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value: string | undefined) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    email: string;

    @column({ type: "string" })
    password?: string;

    @column({
        type: "datetime", beforeSave(old?: Date) {
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

    /**
     * @param namespace
     * @override
     */
    static getDefaultSelect(namespace?: string): string {
        return this.selectColumnsWithout(namespace, "password");
    }

    static async getFull(id: string): Promise<AdminFull | undefined> {
        const [rows] = await Database.select(`SELECT * FROM ${this.table} WHERE \`id\` = ? LIMIT 1`, [id]);

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        const user = this.fromRow(rows[0][this.table]) 

        if (!user) {
            return undefined
        }
        
        return user as AdminFull;
    }


    static async getForAuthentication(email: string): Promise<AdminFull | undefined> {
        const [rows] = await Database.select(`SELECT * FROM ${this.table} WHERE \`email\` = ? LIMIT 1`, [email]);

        if (rows.length == 0) {
            return undefined;
        }
        const user = this.fromRow(rows[0][this.table])

        if (!user) {
            return undefined
        }

        // Read member + address from first row
        return user as AdminFull;
    }

    static async login(email: string, password: string): Promise<AdminFull | undefined> {
        const admin = await this.getForAuthentication(email)
        if (!admin) {
            return undefined
        }

        try {
            if (await argon2.verify(admin.password, password)) {
                return admin
            }
        } catch (e) {
            // internal failure
            console.error(e)
        }
    }

    static async register(email: string, password: string): Promise<Admin | undefined> {

        const user = new Admin();
        user.email = email;
        user.password = await this.hash(password)

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
        user.eraseProperty("password");
        return user;
    }

    static async hash(password: string) {
        const hash = await argon2.hash(password, { type: argon2.argon2id })
        return hash
    }

    async changePassword(password: string): Promise<void> {
        this.password = await Admin.hash(password)
        await this.save()
        this.eraseProperty("password");
    }
}
