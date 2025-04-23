import { column } from '@simonbackx/simple-database';
import { SimpleError } from '@simonbackx/simple-errors';
import { I18n } from '@stamhoofd/backend-i18n';
import { QueryableModel } from '@stamhoofd/sql';
import { EmailTemplateType, Recipient, Replacement } from '@stamhoofd/structures';
import basex from 'base-x';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { sendEmailTemplate } from '../helpers/EmailBuilder';
import { Platform } from './Platform';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const bs58 = basex(ALPHABET);

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
            resolve(n);
        });
    });
}

/**
 * Holds the verificationCodes for a given email (not a user, since a user can switch email addresses and might avoid verification that way)
 */
export class EmailVerificationCode extends QueryableModel {
    static table = 'email_verification_codes';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string', nullable: true })
    organizationId: string | null = null;

    @column({ type: 'string' })
    userId: string;

    /**
     * The e-mail that will get verified. If on verification, the user e-mail differs from this one,
     * we'll set the user email to this email address
     */
    @column({ type: 'string' })
    email: string;

    /**
     * This one is send to the sender. Allows for polling + extra length + sender authentication
     */
    @column({ type: 'string' })
    token = '';

    @column({ type: 'string' })
    code = '';

    /**
     * The amount of times this code has been generated for the same e-mail address
     */
    @column({ type: 'integer' })
    generatedCount = 0;

    /**
     * The amount of times this unique code has been tried.
     */
    @column({ type: 'integer' })
    tries = 0;

    @column({ type: 'datetime' })
    expiresAt: Date;

    /**
     * createdAt behaves more like createdAt for verificationCode. Since every save is considered to have a new verificationCode
     */
    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    static CODE_LENGTH = 6;
    static MAX_TRIES = 9; // minus 0..MAX_TRIES_VARY

    async generateCode() {
        this.code = ((await randomInt(Math.pow(10, EmailVerificationCode.CODE_LENGTH))) + '').padStart(EmailVerificationCode.CODE_LENGTH, '0');
        this.token = bs58.encode(await randomBytes(100)).toLowerCase();

        // Increase generatedCount if we changed the code
        if (this.tries > 0) {
            // For statistics (how many did they try and had to resend the email)
            this.generatedCount++;
        }

        // Reset the real tries
        this.tries = 0;

        // Expire in 12 hours
        this.expiresAt = new Date(new Date().getTime() + 1000 * 60 * 60 * 12);
    }

    getEmailVerificationUrl(user: import('./User').User, organization: import('./Organization').Organization | null, i18n: I18n) {
        let host: string;
        if (user.permissions || !organization || STAMHOOFD.userMode === 'platform') {
            host = 'https://' + (STAMHOOFD.domains.dashboard ?? 'stamhoofd.app') + '/' + i18n.locale;
        }
        else {
            // Add language if different than default
            host = 'https://' + organization.getHost();

            if (i18n.language !== organization.i18n.language) {
                host += '/' + i18n.language;
            }
        }

        return host + '/verify-email' + (user.organizationPermissions && this.organizationId ? '/' + encodeURIComponent(this.organizationId) : '') + '?code=' + encodeURIComponent(this.code) + '&token=' + encodeURIComponent(this.token);
    }

    /**
     * Return true if this token is still valid (used for automatic polling in code view)
     */
    static async poll(organizationId: string | null, token: string): Promise<boolean> {
        const verificationCodes = await this.where({
            token,
            organizationId: {
                sign: 'IN',
                value: [organizationId, null],
            },
        }, { limit: 1 });

        if (verificationCodes.length == 0) {
            return false; // = expired or invalid
        }

        const verificationCode = verificationCodes[0];

        if (verificationCode.token !== token) {
            // Safety check, is not possible
            console.error('Security check failed for verify: check MySQL optimization');
            return false;
        }

        if (verificationCode.expiresAt < new Date()) {
            // Expired.
            // Can't expose this because that would expose a user enumeration attack
            // -> we'll include this expiry date in e-mails
            return false;
        }

        if (verificationCode.tries >= EmailVerificationCode.MAX_TRIES) {
            return false;
        }

        return true;
    }

    /**
     * We don't throw errors here, because we don't want to expose any information about the existance of the code.
     * We just expose if it is valid or not, nothing else
     * False = expired or invalid
     * Error => token okay, but too many attempts checking the code
     *
     */
    static async verify(organizationId: string | null, token: string, code: string): Promise<EmailVerificationCode | undefined> {
        if (code.length !== EmailVerificationCode.CODE_LENGTH) {
            return;
        }

        const verificationCodes = await this.where({
            token,
            organizationId: {
                sign: 'IN',
                value: [organizationId, null],
            },
        }, { limit: 1 });

        if (verificationCodes.length == 0) {
            return; // = expired or invalid
        }

        const verificationCode = verificationCodes[0];

        if (verificationCode.token !== token) {
            // Safety check, is not possible
            console.error('Security check failed for verify: check MySQL optimization');
            return;
        }

        if (verificationCode.expiresAt < new Date()) {
            // Expired.
            // Can't expose this because that would expose a user enumeration attack
            // -> we'll include this expiry date in e-mails
            return;
        }

        if (verificationCode.tries >= EmailVerificationCode.MAX_TRIES) {
            // We can saferly inform the user, because he is authenticated with the token
            throw new SimpleError({
                code: 'too_many_attempts',
                message: 'Too many attempts',
                human: $t(`9ea99caf-e245-45b2-97d5-004393e78b49`),
                statusCode: 429,
            });
        }

        if (verificationCode.code === code || (code === '111111' && STAMHOOFD.environment === 'development')) {
            // Delete all remaining information!
            // To avoid leaving information about the existince of this user (tries)
            await verificationCode.delete();

            return verificationCode;
        }

        verificationCode.tries++;
        await verificationCode.save();

        if (verificationCode.tries >= EmailVerificationCode.MAX_TRIES) {
            // We can saferly inform the user, because he is authenticated with the token
            throw new SimpleError({
                code: 'too_many_attempts',
                message: 'Too many attempts',
                human: $t(`9ea99caf-e245-45b2-97d5-004393e78b49`),
                statusCode: 429,
            });
        }
    }

    async send(user: import('./User').User, organization: import('./Organization').Organization | null, i18n: I18n, withCode = true) {
        const url = this.getEmailVerificationUrl(user, organization, i18n);

        const name = organization?.name ?? (await Platform.getSharedPrivateStruct()).config.name;

        const replacements: Replacement[] = [
            Replacement.create({
                token: 'organizationName',
                value: name,
            }),
            Replacement.create({
                token: 'confirmEmailUrl',
                value: url,
            }),
        ];

        if (withCode) {
            const formattedCode = this.code.substr(0, 3) + ' ' + this.code.substr(3);

            await sendEmailTemplate(organization, {
                recipients: [
                    Recipient.create({
                        email: this.email,
                        replacements: [
                            ...replacements,
                            Replacement.create({
                                token: 'confirmEmailCode',
                                value: formattedCode,
                            }),
                        ],
                    }),
                ],
                template: {
                    type: EmailTemplateType.VerifyEmail,
                },
                type: 'transactional',
            });
        }
        else {
            await sendEmailTemplate(organization, {
                recipients: [
                    Recipient.create({
                        email: this.email,
                        replacements,
                    }),
                ],
                template: {
                    type: EmailTemplateType.VerifyEmailWithoutCode,
                },
                type: 'transactional',
            });
        }
    }

    static async resend(organization: import('./Organization').Organization | null, token: string, i18n: I18n) {
        const verificationCodes = await this.where({
            token,
            organizationId: organization
                ? {
                        sign: 'IN',
                        value: [organization.id, null],
                    }
                : null,
        }, { limit: 1 });

        if (verificationCodes.length == 0) {
            console.log("Can't resend code, no coded found for token", token);
            // TODO: maybe send a note via email
            return;
        }

        const verificationCode = verificationCodes[0];

        if (verificationCode.expiresAt < new Date()) {
            // Don't report error, could be brute forced
            console.log("Can't resend code, token is expired", token);
            return;
        }

        const { User } = await import('./User');
        const user = await User.getByID(verificationCode.userId);
        if (!user) {
            return;
        }
        await verificationCode.send(user, organization, i18n);
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
        const verificationCodes = await this.where({ userId: user.id }, { limit: 1 });

        let verificationCode: EmailVerificationCode;
        if (verificationCodes.length == 0) {
            verificationCode = new EmailVerificationCode();
            verificationCode.organizationId = user.organizationId;
            await verificationCode.generateCode();

            // Reset the real tries
            verificationCode.tries = 0;

            // Expire in 3 hours
            verificationCode.expiresAt = new Date(new Date().getTime() + 1000 * 60 * 60 * 3);
        }
        else {
            verificationCode = verificationCodes[0];

            if (verificationCode.expiresAt < new Date(new Date().getTime() - 15 * 60 * 1000) || verificationCode.tries >= EmailVerificationCode.MAX_TRIES) {
                // Expired: also update the token
                await verificationCode.generateCode();
            }
        }

        verificationCode.email = email;
        verificationCode.userId = user.id;

        await verificationCode.save();
        return verificationCode;
    }
}
