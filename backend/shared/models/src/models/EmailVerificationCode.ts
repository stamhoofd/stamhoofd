import { column, Model } from "@simonbackx/simple-database";
import { SimpleError } from "@simonbackx/simple-errors";
import { I18n } from "@stamhoofd/backend-i18n";
import { Email } from "@stamhoofd/email";
import basex from "base-x";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

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

    @column({ type: "string" })
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

    // static user = new ManyToOneRelation(require('./User').default, "user");

    static async getFor(organizationId: string, email: string): Promise<EmailVerificationCode | undefined> {
        // TODO: make this constant time to avoid complex timing attacks (especially when under load)
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

        // Increase generatedCount if we changed the code
        if (this.tries > 0) {
            // For statistics (how many did they try and had to resend the email)
            this.generatedCount++;
        }

        // Reset the real tries
        this.tries = 0

        // Expire in 3 hours
        this.expiresAt = new Date(new Date().getTime() + 1000 * 60 * 60 * 3)
    }

    getEmailVerificationUrl(user: import('./User').User, organization: import('./Organization').Organization, i18n: I18n) {
        let host: string;
        if (user.permissions) {
            host = "https://"+(STAMHOOFD.domains.dashboard ?? "stamhoofd.app")+"/"+i18n.locale
        } else {
            // Add language if different than default
            host = "https://"+organization.getHost()

            if (i18n.language != organization.i18n.language) {
                host += "/"+i18n.language
            }
        }

        return host+"/verify-email"+(user.permissions ? "/"+encodeURIComponent(organization.id) : "")+"?code="+encodeURIComponent(this.code)+"&token="+encodeURIComponent(this.token);
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

        if (verificationCode.code === code || (code === "111111" && STAMHOOFD.environment === "development")) {
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

    send(user: import('./User').User, organization: import('./Organization').Organization, i18n: I18n, withCode = true) {
        const { from, replyTo } = {
            from: (user.permissions ? Email.getInternalEmailFor(i18n) : organization.getStrongEmail(i18n)),
            replyTo: undefined // Don't use replyTo because it affects deliverability rates due to spam filters
        }

        const url = this.getEmailVerificationUrl(user, organization, i18n)

        const footer = (!user.permissions ? "\n\n—\n\nOnze ledenadministratie werkt via het Stamhoofd platform, op maat van verenigingen. Probeer het ook via https://"+i18n.$t("shared.domains.marketing")+"/ledenadministratie\n\n" : '')
        const footerHTML = (!user.permissions ? "<br><br>—<br><br>Onze ledenadministratie werkt via het Stamhoofd platform, op maat van verenigingen. Probeer het ook via <a href=\"https://"+i18n.$t("shared.domains.marketing")+"/ledenadministratie\">Stamhoofd</a><br><br>" : '')

        if (withCode) {
            const formattedCode = this.code.substr(0, 3)+" "+this.code.substr(3)
            Email.send({
                from,
                replyTo,
                to: this.email,
                subject: `[${user.permissions ? "Stamhoofd" : organization.name}] Verifieer jouw e-mailadres`,
                type: "transactional",
                text: `Hallo${user.firstName ? (" "+user.firstName) : ""}!\n\nVerifieer jouw e-mailadres om te kunnen inloggen bij ${organization.name}. Vul de code "${formattedCode}" in op de website of klik op de onderstaande link om jouw e-mailadres te bevestigen.\n${url}\n\nDit is een automatische e-mail. Gelieve niet op dit e-mailadres te reageren.\n\n${user.permissions ? "Stamhoofd" : organization.name}`+footer,
                html: `Hallo${user.firstName ? (" "+user.firstName) : ""}!<br><br>Verifieer jouw e-mailadres om te kunnen inloggen bij ${organization.name}. Vul de onderstaande code in op de website<br><br><strong style="font-size: 30px; font-weight: bold;">${formattedCode}</strong><br><br>Of klik op de onderstaande link om jouw e-mailadres te bevestigen:<br>${url}<br><br>Dit is een automatische e-mail. Gelieve niet op dit e-mailadres te reageren.<br><br>${user.permissions ? "Stamhoofd" : organization.name}`+footerHTML
            })
        } else {
            Email.send({
                from,
                replyTo,
                to: this.email,
                type: "transactional",
                subject: `[${user.permissions ? "Stamhoofd" : organization.name}] Verifieer jouw e-mailadres`,
                text: `Hallo${user.firstName ? (" "+user.firstName) : ""}!\n\nVerifieer jouw e-mailadres om te kunnen inloggen bij ${organization.name}. Klik op de onderstaande link om jouw e-mailadres te bevestigen.\n${url}\n\nDit is een automatische e-mail. Gelieve niet op dit e-mailadres te reageren.\n\n${user.permissions ? "Stamhoofd" : organization.name}`+footer
            })
        }
    }

    static async resend(organization: import('./Organization').Organization, token: string, i18n: I18n) {
        const verificationCodes = await this.where({ token, organizationId: organization.id }, { limit: 1 })

        if (verificationCodes.length == 0) {
            console.log("Can't resend code, no coded found for token", token)
            // TODO: maybe send a note via email
            return
        }

        const verificationCode = verificationCodes[0]

        if (verificationCode.expiresAt < new Date()) {
            // Don't report error, could be brute forced
            console.log("Can't resend code, token is expired", token)
            return 
        }

        const {User} = await import('./User')
        const user = await User.getByID(verificationCode.userId)
        if (!user) {
            return
        }
        verificationCode.send(user, organization, i18n)
    }

    /**
     * Create or reuse a verification code for a given email address
     * If needed, it will update the code. 
     * Use this method for sending only, not for verification!
     */
    static async createFor(user: import('./User').User, email: string): Promise<EmailVerificationCode> {
        // TODO: make this constant time to avoid complex timing attacks (especially when under load)
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
            await verificationCode.generateCode()

            // Reset the real tries
            verificationCode.tries = 0

            // Expire in 3 hours
            verificationCode.expiresAt = new Date(new Date().getTime() + 1000 * 60 * 60 * 3)
        } else {
            verificationCode = verificationCodes[0]

            if (verificationCode.expiresAt < new Date(new Date().getTime() - 15 * 60 * 1000) || verificationCode.tries >= EmailVerificationCode.MAX_TRIES) {
                // Expired: also update the token
                await verificationCode.generateCode()
            }
        }
        
        verificationCode.email = email
        verificationCode.userId = user.id



        await verificationCode.save()
        
        return verificationCode
    }
}
