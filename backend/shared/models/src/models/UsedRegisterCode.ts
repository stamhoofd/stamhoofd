import { column, Model } from "@simonbackx/simple-database";
import { Email } from "@stamhoofd/email";
import { Formatter } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";

import { Organization, RegisterCode, STCredit } from "./";

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

    static async getFor(organizationId: string): Promise<UsedRegisterCode | undefined> {
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

        const receivingOrganization = await Organization.getByID(code.organizationId)
        if (!receivingOrganization) {
            console.error("Couldn't find receiving organization with id "+code.organizationId+" for used register code "+this.id)
            return
        }

        const usedCount = await UsedRegisterCode.getUsedCount(this.code) + 1

        const credit = new STCredit()
        credit.organizationId = code.organizationId
        credit.change = Math.min(100 * 100, usedCount * 10 * 100)
        credit.description = organization.name+" doorverwezen 🙌"

        // Expire in one year (will get extended for every purchase or activation)
        credit.expireAt = new Date()
        credit.expireAt.setFullYear(credit.expireAt.getFullYear() + 1)
        credit.expireAt.setMilliseconds(0)

        await credit.save()
        this.creditId = credit.id
        await this.save()

        const admins = await receivingOrganization.getAdminToEmails()
        if (admins) {
            // Delay email until everything is validated and saved
            Email.sendInternal({
                to: admins,
                bcc: "simon@stamhoofd.be",
                subject: "Je hebt "+Formatter.price(credit.change)+" tegoed ontvangen 💰",
                text: "Dag "+receivingOrganization.name+",\n\nGeweldig nieuws! "+organization.name+" had jullie doorverwijzingslink gebruikt om zich op Stamhoofd te registreren, en nu hebben ze ook voor het eerst minstens één euro uitgegeven. Daardoor ontvangen jullie "+Formatter.price(credit.change)+" tegoed voor Stamhoofd (zie daarvoor Stamhoofd > Instellingen). "
                + (credit.change <= 90*100 ? ("Bij de volgende vereniging ontvangen jullie nog meer: "+Formatter.price(credit.change + 10*100)+". ") : "")
                + (credit.change <= 80*100 ? ("En dat blijft oplopen tot € 100,00 per vereniging die je aanbrengt 🎁 ") : "")
                + "Doe zo verder! Lees zeker onze tips na om nog een groter bedrag te verzamelen 😉\n\n— Stamhoofd"
            }, organization.i18n)
        }
    }

    static async getAll(code: string) {
        const used = await UsedRegisterCode.where({ 
            code
        })
        return used
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
