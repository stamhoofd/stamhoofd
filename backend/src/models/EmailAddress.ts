import { column, Database, Model } from '@simonbackx/simple-database';
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

async function randomBytes(size: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(size, (err: Error | null, buf: Buffer) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(buf);
        });
    });
}

export class EmailAddress extends Model {
    static table = "email_addresses";

     @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    organizationId: string;

    // Columns
    @column({ type: "string" })
    email: string;

    @column({ type: "boolean" })
    markedAsSpam = false;

    @column({ type: "boolean" })
    hardBounce = false;

    @column({ type: "boolean" })
    unsubscribedMarketing = false;

    @column({ type: "boolean" })
    unsubscribedAll = false;

    @column({ type: "string" })
    token: string;

    /**
     * createdAt behaves more like createdAt for Challenge. Since every save is considered to have a new challenge
     */
    @column({
        type: "datetime", beforeSave() {
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

    static async getOrCreate(email: string, organizationId: string): Promise<EmailAddress> {
        const existing = await this.getByEmail(email, organizationId)
        if (existing) {
            return existing
        }

        const n = new EmailAddress()
        n.organizationId = organizationId
        n.email = email
        n.token = (await randomBytes(64)).toString("base64").toUpperCase();

        await n.save()

        return n
    }

    // Methods
    static async getByEmails(emails: string[], organizationId: string): Promise<EmailAddress[]> {
        if (emails.length > 30) {
            // Normally an organization will never have so much bounces, so we'll request all emails and filter in them
            const all = await this.where({ organizationId })
            return all.filter(e => emails.includes(e.email))
        }
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()} FROM ${this.table} WHERE \`email\` IN (?) AND \`organizationId\` = ?`,
            [emails, organizationId]
        );

        return this.fromRows(rows, this.table);
    }

    // Methods
    static async getByEmail(email: string, organizationId: string): Promise<EmailAddress | undefined> {
        const [rows] = await Database.select(
            `SELECT ${this.getDefaultSelect()} FROM ${this.table} WHERE \`email\` = ? AND \`organizationId\` = ? LIMIT 1`,
            [email, organizationId]
        );

        if (rows.length == 0) {
            return undefined;
        }

        // Read member + address from first row
        return this.fromRow(rows[0][this.table]);
    }
}
