import { column, Model } from "@simonbackx/simple-database";
import { SimpleError } from "@simonbackx/simple-errors";
import { EmailInterfaceBase } from "@stamhoofd/email";
import basex from "base-x";
import crypto from "crypto";

import { Organization } from "./Organization";
import { STCredit } from "./STCredit";
import { UsedRegisterCode } from "./UsedRegisterCode";
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const bs58 = basex(ALPHABET)

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

export class RegisterCode extends Model {
    static table = "register_codes";

    @column({ type: "string", primary: true })
    code: string;

    @column({ type: "string" })
    description: string;

    @column({ type: "string", nullable: true })
    organizationId: string | null;

    @column({ type: "integer" })
    value: number;

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

    async generateCode() {
        this.code = bs58.encode(await randomBytes(8)).toUpperCase();
    }

    /**
     * Prepares a register code for usage.
     * Returns the models to save and the emails to send when succesful
     */
    static async applyRegisterCode(organization: Organization, codeString: string): Promise<{models: Model[], emails: EmailInterfaceBase[]}> {
        const alreadyUsed = await UsedRegisterCode.getFor(organization.id)
        if (alreadyUsed) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Invalid register code",
                human: "Je hebt al een doorverwijzingscode gebruikt",
                field: "registerCode",
            });
        }

        const code = await RegisterCode.getByID(codeString)
        if (!code) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Invalid register code",
                human: "De doorverwijzingscode die je hebt opgegeven is niet langer geldig",
                field: "registerCode",
            });
        }

        const otherOrganization = code.organizationId ? await Organization.getByID(code.organizationId) : undefined
        
        const delayEmails: EmailInterfaceBase[] = []
        let credit: STCredit | undefined = undefined
        let usedCode: UsedRegisterCode | undefined = undefined

        if (code.value > 0) {
            // Create initial credit
            credit = new STCredit()
            credit.organizationId = organization.id
            credit.change = code.value
            credit.description = otherOrganization ? ("Tegoed gekregen van "+otherOrganization.name) : code.description

            // Expire in one year (will get extended for every purchase or activation)
            credit.expireAt = new Date()
            credit.expireAt.setFullYear(credit.expireAt.getFullYear() + 1)
            credit.expireAt.setMilliseconds(0)

            // Save later
        }

        if (otherOrganization) {
            const admins = await otherOrganization.getAdminToEmails()
            if (admins) {
                // Delay email until everything is validated and saved
                delayEmails.push({
                    to: admins,
                    bcc: "simon@stamhoofd.be",
                    subject: organization.name+" heeft jullie doorverwijzingslink gebruikt 🥳",
                    type: "transactional",
                    text: "Dag "+otherOrganization.name+",\n\nGoed nieuws! "+organization.name+" heeft jullie doorverwijzingslink gebruikt om zich op Stamhoofd te registreren. Als zij minstens 1 euro op Stamhoofd uitgeven ontvangen jullie een tegoed dat kan oplopen tot 100 euro per vereniging (zie daarvoor Stamhoofd > Instellingen). Lees zeker onze tips na om nog een groter bedrag te verzamelen 😉\n\n— Stamhoofd"
                })
            }
        } else {
            delayEmails.push({
                to: 'hallo@stamhoofd.be',
                subject: organization.name+" heeft jullie doorverwijzingslink gebruikt 🥳",
                type: "transactional",
                text: "Dag Stamhoofd,\n\nGoed nieuws! "+organization.name+" heeft jullie doorverwijzingslink "+code.code+" gebruikt om zich op Stamhoofd te registreren. \n\n— Stamhoofd"
            })
        }

        // Save that we used this code (so we can reward the other organization)
        usedCode = new UsedRegisterCode()
        usedCode.organizationId = organization.id
        usedCode.code = code.code
        
        // Save later
        return {
            models: credit ? [credit, usedCode] : [usedCode],
            emails: delayEmails
        }
    }
}
