import { column, Model } from "@simonbackx/simple-database";
import { v4 as uuidv4 } from "uuid";
import { Organization } from "./Organization";
import { RegisterCode } from "./RegisterCode";
import { STCredit } from "./STCredit";

export class UsedRegisterCode extends Model {
    static table = "used_register_codes";

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    code: string;

    /**
     * Code is used by...
     */
    @column({ type: "string" })
    organizationId: string;

    /**
     * Set if this has been rewarded
     */
    @column({ type: "string", nullable: true })
    creditId: string | null = null;

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

    static async getFor(organizationId: string): Promise<UsedRegisterCode | undefined> {
        const code = await this.where({ organizationId }, { limit: 1 })
        return code[0] ?? undefined
    }

    async reward() {
        if (this.creditId) {
            // Already received
            console.error("Already rewarded for used register code "+this.id)
            return
        }

        const code = await RegisterCode.getByID(this.code)
        if (!code || !code.organizationId) {
            console.error("Couldn't find code "+this.code+" for used register code "+this.id)
            return
        }

        const organization = await Organization.getByID(this.organizationId)
        if (!organization) {
            console.error("Couldn't find organization with id "+this.organizationId+" for used register code "+this.id)
            return
        }

        const usedCount = await UsedRegisterCode.getUsedCount(this.code) + 1

        const credit = new STCredit()
        credit.organizationId = credit.organizationId = code.organizationId
        credit.change = Math.min(100 * 100, usedCount * 10 * 100)
        credit.description = organization.name+", die je had doorverwezen, gebruikt nu Stamhoofd! 🙌"

        // Expire in one year (will get extended for every purchase or activation)
        credit.expireAt = new Date()
        credit.expireAt.setFullYear(credit.expireAt.getFullYear() + 1)
        credit.expireAt.setMilliseconds(0)

        await credit.save()
        this.creditId = credit.id
        await this.save()
    }

    static async getUsed(code: string) {
        const used = await UsedRegisterCode.where({ 
            code, 
            creditId: {
                value: null,
                sign: "!="
            }
        })
        return used
    }

    static async getUsedCount(code: string) {
        const used = await this.getUsed(code)
        return used.length
    }
}
