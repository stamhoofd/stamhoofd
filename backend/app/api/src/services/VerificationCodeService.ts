import type { I18n } from '@stamhoofd/backend-i18n';
import type { Organization } from '@stamhoofd/models';
import { EmailVerificationCode, Platform, sendEmailTemplate, User } from '@stamhoofd/models';
import { EmailTemplateType, getAppHost, Recipient, Replacement } from '@stamhoofd/structures';

/**
 * Owns sending the verification emails for an EmailVerificationCode.
 *
 * The code itself (generating, storing, verifying and rate limiting it) stays on the model: that is
 * data access. Building the verification url and composing the email is not, and it needs the
 * platform name as a fallback when the code is not scoped to an organization. Models cannot resolve
 * the platform they belong to, so that logic lives here.
 */
export class VerificationCodeService {
    static getEmailVerificationUrl(code: EmailVerificationCode, user: User, organization: Organization | null, i18n: I18n) {
        const host = getAppHost('verify-email', organization, !!user.permissions, i18n);
        return 'https://' + host + '?code=' + encodeURIComponent(code.code) + '&token=' + encodeURIComponent(code.token) + '&email=' + encodeURIComponent(code.email);
    }

    static async send(code: EmailVerificationCode, user: User, organization: Organization | null, i18n: I18n, withCode = true) {
        const url = this.getEmailVerificationUrl(code, user, organization, i18n);

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
            const formattedCode = code.code.substr(0, 3) + ' ' + code.code.substr(3);

            await sendEmailTemplate(organization, {
                recipients: [
                    Recipient.create({
                        email: code.email,
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
        } else {
            await sendEmailTemplate(organization, {
                recipients: [
                    Recipient.create({
                        email: code.email,
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

    static async resend(organization: Organization | null, token: string, i18n: I18n) {
        const verificationCodes = await EmailVerificationCode.where({
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

        const user = await User.getByID(verificationCode.userId);
        if (!user) {
            return;
        }
        await this.send(verificationCode, user, organization, i18n);
    }
}
