/* eslint-disable @typescript-eslint/camelcase */
import { column, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { SimpleError } from "@simonbackx/simple-errors"
import basex from "base-x";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

import { Email } from "@stamhoofd/email";
import { Organization } from "./Organization";
import { User, UserWithOrganization } from "./User";
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

async function randomInt(max: number): Promise<number> {
    return new Promise((resolve, reject) => {
        crypto.randomInt(max, (err: Error | null, n: number) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(n)
        })
    })
}


/**
 * Holds the verificationCodes for a given email (not a user, since a user can switch email addresses and might avoid verification that way)
 */
export class EmailVerificationCode extends Model {
    static table = "email_verification_codes";

     @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    organizationId: string;

    @column({ type: "string", foreignKey: EmailVerificationCode.user })
    userId: string;

    /**
     * The e-mail that will get verified. If on verification, the user e-mail differs from this one,
     * we'll set the user email to this email address
     */
    @column({ type: "string" })
    email: string;

    /**
     * This one is send to the sender. Allows for polling + extra length + sender authentication
     */
    @column({ type: "string" })
    token = "";

    @column({ type: "string" })
    code = "";

    /**
     * The amount of times this code has been generated for the same e-mail address
     */
    @column({ type: "integer" })
    generatedCount = 0;

    /**
     * The amount of times this unique code has been tried.
     */
    @column({ type: "integer" })
    tries = 0;

    @column({ type: "datetime" })
    expiresAt: Date;

    /**
     * createdAt behaves more like createdAt for verificationCode. Since every save is considered to have a new verificationCode
     */
    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        }
    })
    createdAt: Date

    static CODE_LENGTH = 6
    static MAX_TRIES = 9 // minus 0..MAX_TRIES_VARY

    static user = new ManyToOneRelation(User, "user");

    static async getFor(organizationId: string, email: string): Promise<EmailVerificationCode | undefined> {
        // todo: make this constant time to avoid complex timing attacks (especially when under load)
        // Do we already have a verificationCode for this email?
        const verificationCodes = await this.where({ email, organizationId }, { limit: 1 })

       if (verificationCodes.length == 1) {
           const verificationCode = verificationCodes[0]
           if (verificationCode.expiresAt < new Date()) {
               return
           }
           return verificationCode
       }

        return
    }

    async generateCode() {
        this.code = ((await randomInt(Math.pow(10, EmailVerificationCode.CODE_LENGTH)))+"").padStart(EmailVerificationCode.CODE_LENGTH, "0")
        this.token = bs58.encode(await randomBytes(100)).toLowerCase();
    }

    getEmailVerificationUrl(user: UserWithOrganization) {
        let host: string;
        if (user.permissions) {
            host = "https://"+(process.env.HOSTNAME_DASHBOARD ?? "stamhoofd.app")
        } else {
            host = "https://"+user.organization.getHost()
        }

        return host+"/verify-email"+(user.permissions ? "/"+encodeURIComponent(user.organization.id) : "")+"?code="+encodeURIComponent(this.code)+"&token="+encodeURIComponent(this.token);
    }

    /**
     * Return true if this token is still valid (used for automatic polling in code view)
     */
    static async poll(organizationId: string, token: string): Promise<boolean> {
        const verificationCodes = await this.where({ token, organizationId }, { limit: 1 })

        if (verificationCodes.length == 0) {
            return false // = expired or invalid
        }

        const verificationCode = verificationCodes[0]

        if (verificationCode.token !== token) {
            // Safety check, is not possible
            console.error("Security check failed for verify: check MySQL optimization")
            return false;
        }

        if (verificationCode.expiresAt < new Date()) {
            // Expired. 
            // Can't expose this because that would expose a user enumeration attack
            // -> we'll include this expiry date in e-mails
            return false
        }

        if (verificationCode.tries >= EmailVerificationCode.MAX_TRIES) {
            return false
        }

        return true
    }

    /**
     * We don't throw errors here, because we don't want to expose any information about the existance of the code.
     * We just expose if it is valid or not, nothing else
     * False = expired or invalid
     * Error => token okay, but too many attempts checking the code
     * 
     */
    static async verify(organizationId: string, token: string, code: string): Promise<EmailVerificationCode | undefined> {
        if (code.length != EmailVerificationCode.CODE_LENGTH) {
            return
        }
        
        const verificationCodes = await this.where({ token, organizationId }, { limit: 1 })

        if (verificationCodes.length == 0) {
            return // = expired or invalid
        }

        const verificationCode = verificationCodes[0]

        if (verificationCode.token !== token) {
            // Safety check, is not possible
            console.error("Security check failed for verify: check MySQL optimization")
            return;
        }

        if (verificationCode.expiresAt < new Date()) {
            // Expired. 
            // Can't expose this because that would expose a user enumeration attack
            // -> we'll include this expiry date in e-mails
            return
        }

        if (verificationCode.tries >= EmailVerificationCode.MAX_TRIES) {
            // We can saferly inform the user, because he is authenticated with the token
            throw new SimpleError({
                code: "too_many_attempts",
                message: "Too many attempts",
                human: "Je hebt de code te veel foutief ingegeven. Verstuur eerst een nieuwe code voor je opnieuw probeert.",
                statusCode: 429
            })
        }

        if (verificationCode.code === code) {
            // Delete all remaining information!
            // To avoid leaving information about the existince of this user (tries)
            await verificationCode.delete()

            return verificationCode
        }

        verificationCode.tries++
        await verificationCode.save()

        if (verificationCode.tries >= EmailVerificationCode.MAX_TRIES) {
            // We can saferly inform the user, because he is authenticated with the token
            throw new SimpleError({
                code: "too_many_attempts",
                message: "Too many attempts",
                human: "Je hebt de code te veel foutief ingegeven. Verstuur eerst een nieuwe code voor je opnieuw probeert.",
                statusCode: 429
            })
        }
    }

    send(user: UserWithOrganization, withCode = true) {
        const { from, replyTo } = user.organization.getDefaultEmail()

        if (withCode) {
            const formattedCode = this.code.substr(0, 3)+" "+this.code.substr(3)
            
            Email.send({
                from,
                replyTo,
                to: this.email,
                subject: `[${user.permissions ? "Stamhoofd" : user.organization.name}] Verifieer jouw e-mailadres`,
                text: `Hallo${user.firstName ? (" "+user.firstName) : ""}!\n\nVerifieer jouw e-mailadres om te kunnen inloggen bij ${user.organization.name}. Vul de code "${formattedCode}" in op de website of klik op de onderstaande link om jouw e-mailadres te bevestigen.\n${this.getEmailVerificationUrl(user)}\n\n${user.permissions ? "Stamhoofd" : user.organization.name}`,
                html: `Hallo${user.firstName ? (" "+user.firstName) : ""}!<br><br>Verifieer jouw e-mailadres om te kunnen inloggen bij ${user.organization.name}. Vul de onderstaande code in op de website<br><br><strong style="font-size: 30px; font-weight: bold;">${formattedCode}</strong><br><br>Of klik op de onderstaande link om jouw e-mailadres te bevestigen:<br>${this.getEmailVerificationUrl(user)}<br><br>${user.permissions ? "Stamhoofd" : user.organization.name}`
            })
        } else {
            Email.send({
                from,
                replyTo,
                to: this.email,
                subject: `[${user.permissions ? "Stamhoofd" : user.organization.name}] Verifieer jouw e-mailadres`,
                text: `Hallo${user.firstName ? (" "+user.firstName) : ""}!\n\nVerifieer jouw e-mailadres om te kunnen inloggen bij ${user.organization.name}. Klik op de onderstaande link om jouw e-mailadres te bevestigen.\n${this.getEmailVerificationUrl(user)}\n\n${user.permissions ? "Stamhoofd" : user.organization.name}`
            })
        }
    }

    static async resend(organization: Organization, token: string): Promise<undefined | string> {
        const verificationCodes = await this.where({ token, organizationId: organization.id }, { limit: 1 })

        if (verificationCodes.length == 0) {
            // Todo: maybe send a note via email
            return
        }

        const verificationCode = verificationCodes[0]

        if (verificationCode.expiresAt < new Date()) {
            // Don't report error, could be brute forced
            return 
        }

        const user = await User.getByID(verificationCode.userId)
        if (!user) {
            return
        }
        verificationCode.send(user.setRelation(User.organization, organization))
    }

    /**
     * Create or reuse a verification code for a given email address
     * If needed, it will update the code. 
     * Use this method for sending only, not for verification!
     */
    static async createFor(user: User, email: string): Promise<EmailVerificationCode> {
        // todo: make this constant time to avoid complex timing attacks (especially when under load)
        // Do we already have a verificationCode for this email?

        // Only user <-> organization binding is unique
        // Since, when changing email, we don't throw an error if it is use (user enumeration)
        // So multiple users should be able to request changing to a password, but only on validation should they fail
        // (or this should be noted in the verification email and accounts could be merged)
        const verificationCodes = await this.where({ userId: user.id }, { limit: 1 })

        let verificationCode: EmailVerificationCode
        if (verificationCodes.length == 0) {
            verificationCode = new EmailVerificationCode()
            verificationCode.organizationId = user.organizationId
        } else {
            verificationCode = verificationCodes[0]
        }

        // Change the code every time
        await verificationCode.generateCode()

        // Increase generatedCount if we changed the code
        if (verificationCode.tries > 0) {
            // For statistics (how many did they try and had to resend the email)
            verificationCode.generatedCount++;
        }

        // Reset the real tries
        verificationCode.tries = 0
        verificationCode.email = email
        verificationCode.userId = user.id

        // Expire in 3 hours
        verificationCode.expiresAt = new Date(new Date().getTime() + 1000 * 60 * 60 * 3)

        await verificationCode.save()
        
        return verificationCode
    }
}
