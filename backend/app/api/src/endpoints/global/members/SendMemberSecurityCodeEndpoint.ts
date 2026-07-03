import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import type { Organization } from '@stamhoofd/models';
import { AuditLog, Member, Platform, RateLimiter, sendEmailTemplate } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogSource, AuditLogType, EmailTemplateType, Recipient, Replacement, SecurityCodeSendMethod, SendMemberSecurityCodeRequest, SendMemberSecurityCodeResponse } from '@stamhoofd/structures';
import type { Country } from '@stamhoofd/types/Country';
import { Formatter } from '@stamhoofd/utility';

import { Context } from '../../../helpers/Context.js';
import { SMSService } from '../../../services/SMSService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = SendMemberSecurityCodeRequest;
type ResponseBody = SendMemberSecurityCodeResponse;

/**
 * Only allow to send a code a limited number of times for the same member.
 */
export const memberSecurityCodeSendLimiter = new RateLimiter({
    limits: [
        {
            limit: 3,
            duration: 5 * 60 * 1000,
        },
        {
            limit: 6,
            duration: 12 * 60 * 60 * 1000,
        },
        {
            limit: 9,
            duration: 3 * 24 * 60 * 60 * 1000,
        },
    ],
});

/**
 * Email limit is lower because no reason to send multiple times
 */
export const memberEmailSecurityCodeSendLimiter = new RateLimiter({
    limits: [
        {
            limit: 1,
            duration: 5 * 60 * 1000,
        },
        {
            limit: 2,
            duration: 12 * 60 * 60 * 1000,
        },
        {
            limit: 3,
            duration: 3 * 24 * 60 * 60 * 1000,
        },
    ],
});

/**
 * Limit per member name + organization, so a birth day cannot be guessed or detected by
 * trying different birth days for a known member name.
 */
export const nameSecurityCodeSendLimiter = new RateLimiter({
    limits: [
        {
            // Max 10 requests per hour
            limit: 10,
            duration: 60 * 60 * 1000,
        },
        {
            // Max 20 requests per day
            limit: 20,
            duration: 24 * 60 * 60 * 1000,
        },
    ],
});

/**
 * Limit per user to avoid member enumeration attacks.
 */
export const userSecurityCodeSendLimiter = new RateLimiter({
    limits: [
        {
            // Max 20 requests per hour
            limit: 20,
            duration: 60 * 60 * 1000,
        },
        {
            // Max 30 requests per day
            limit: 30,
            duration: 24 * 60 * 60 * 1000,
        },
        {
            // Max 100 requests per week
            limit: 100,
            duration: 7 * 24 * 60 * 60 * 1000,
        },
    ],
});

/**
 * Limit the number of SMS messages per organization (SMS costs money).
 */
export const smsOrganizationLimiter = new RateLimiter({
    limits: [
        {
            // Max 25 SMS per day
            limit: 25,
            duration: 24 * 60 * 60 * 1000,
        },
    ],
});

/**
 * Limit how often the provided phone number can be checked against a member's known numbers. Because a
 * wrong number returns an error, this would otherwise be an oracle to enumerate a member's phone numbers.
 */
export const memberPhoneLookupLimiter = new RateLimiter({
    limits: [
        {
            // Max 10 attempts per hour
            limit: 10,
            duration: 60 * 60 * 1000,
        },
        {
            // Max 30 attempts per day
            limit: 30,
            duration: 24 * 60 * 60 * 1000,
        },
    ],
});

/**
 * Send the security code of a member to the member (or its parents), so an authenticated user can gain
 * access to a member that is already known in the system but not yet linked to their account.
 */
export class SendMemberSecurityCodeEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = SendMemberSecurityCodeRequest as Decoder<SendMemberSecurityCodeRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/members/security-code', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        const { user } = await Context.authenticate();

        const body = request.body;

        // Enumeration defense: always consume the per-user rate limit first, before revealing anything.
        try {
            userSecurityCodeSendLimiter.track(user.id, 1);
        } catch (e) {
            throw new SimpleError({
                code: 'too_many_requests',
                message: 'Too many security code requests for this user',
                human: $t(`%ZbM`),
                statusCode: 429,
            });
        }

        const member = await this.findMember(body, organization);
        if (!member) {
            throw new SimpleError({
                code: 'member_not_found',
                message: 'No member found for the given details',
                human: $t(`%ZbF`),
                statusCode: 404,
            });
        }

        if (body.method === SecurityCodeSendMethod.SMS) {
            return new Response(await this.sendViaSMS(member, organization, body.tryCount, body.phone));
        }

        return new Response(await this.sendViaEmail(member, organization));
    }

    /**
     * Look up the member by id, or by the combination of first name, last name and birth day.
     * String matching relies on the case- and accent-insensitive collation of the database.
     */
    private async findMember(body: SendMemberSecurityCodeRequest, organization: Organization | null): Promise<Member | undefined> {
        if (body.memberId) {
            return (await Member.getByID(body.memberId)) ?? undefined;
        }

        if (!body.firstName || !body.lastName || !body.birthDay) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Either memberId or firstName, lastName and birthDay are required',
                human: $t(`%Zb9`),
                statusCode: 400,
            });
        }

        // Rate limit by member name + organization (checked before the lookup, so a birth day cannot be
        // guessed or detected by trying different birth days for a known member name).
        const nameKey = (organization?.id ?? 'platform') + ':' + body.firstName.toLowerCase().trim() + ' ' + body.lastName.toLowerCase().trim();
        try {
            nameSecurityCodeSendLimiter.track(nameKey, 1);
        } catch (e) {
            throw new SimpleError({
                code: 'too_many_requests',
                message: 'Too many security code requests for this member name',
                human: $t(`%ZbM`),
                statusCode: 429,
            });
        }

        const query: { firstName: string; lastName: string; birthDay: string; organizationId?: string } = {
            firstName: body.firstName,
            lastName: body.lastName,
            birthDay: Formatter.dateIso(body.birthDay),
        };

        // In organization mode members are scoped to a single organization
        if (organization && STAMHOOFD.userMode !== 'platform') {
            query.organizationId = organization.id;
        }

        const members = await Member.where(query);
        if (members.length === 0) {
            return undefined;
        }

        // Prefer a member that already has a security code set
        return members.find(m => m.details.securityCode) ?? members[0];
    }

    /**
     * Make sure the member has a security code, generating one if needed.
     */
    private async ensureSecurityCode(member: Member): Promise<string> {
        if (member.details.securityCode === null) {
            member.details.securityCode = await Member.generateSecurityCode();
            await member.save();
        }
        return member.details.securityCode;
    }

    private async sendViaEmail(member: Member, organization: Organization | null): Promise<SendMemberSecurityCodeResponse> {
        const emails = Formatter.uniqueArray([
            ...member.details.getMemberEmails(),
            ...member.details.getParentEmails(),
            ...member.details.unverifiedEmails,
        ].map(e => e.toLowerCase().trim()));

        if (emails.length === 0) {
            throw new SimpleError({
                code: 'no_email',
                message: 'No email address is known for this member',
                human: $t(`%Zb1`),
                statusCode: 400,
            });
        }

        // Once every 5 minutes per member
        this.trackMemberLimit(member, SecurityCodeSendMethod.Email);

        const code = await this.ensureSecurityCode(member);
        const formattedCode = Formatter.spaceString(code, 4, '-');

        await sendEmailTemplate(organization, {
            recipients: emails.map(email => Recipient.create({
                firstName: member.details.firstName,
                lastName: member.details.lastName,
                email,
                replacements: [
                    Replacement.create({ token: 'requesterEmail', value: Context.auth.user.email }),
                    Replacement.create({ token: 'firstNameMember', value: member.details.firstName }),
                    Replacement.create({ token: 'lastNameMember', value: member.details.lastName }),
                    Replacement.create({
                        token: 'securityCode',
                        value: formattedCode,
                        html: `<p class="style-code-large">${Formatter.escapeHtml(formattedCode)}</p>`,
                    }),
                ],
            })),
            template: {
                type: EmailTemplateType.MemberSecurityCode,
            },
            type: 'transactional',
        });

        await this.logSecurityCodeRequested(member, SecurityCodeSendMethod.Email, emails.join(', '));

        return SendMemberSecurityCodeResponse.create({
            method: SecurityCodeSendMethod.Email,
            maskedRecipient: '',
        });
    }

    private async sendViaSMS(member: Member, organization: Organization | null, tryCount: number, requestedPhone: string | null): Promise<SendMemberSecurityCodeResponse> {
        // Collect candidate phone numbers, member first, then parents.
        const uniquePhones = member.details.getPhoneNumbersForVerification();

        if (uniquePhones.length === 0) {
            throw new SimpleError({
                code: 'no_phone',
                message: 'No phone number is known for this member',
                human: $t(`%Zal`),
                statusCode: 400,
            });
        }

        const defaultCountry = member.details.address?.country ?? organization?.address?.country;

        let phone: string;
        if (requestedPhone !== null && requestedPhone.trim().length > 0) {
            // The user filled in a phone number: only send to it if we already know it for this member.
            // We never send to an arbitrary number (that would leak the code), and this lookup is rate
            // limited per member so it cannot be used to enumerate a member's phone numbers.
            try {
                memberPhoneLookupLimiter.track(member.id, 1);
            } catch (e) {
                throw new SimpleError({
                    code: 'too_many_requests',
                    message: 'Too many phone number lookups for this member',
                    human: $t(`%ZbL`),
                    statusCode: 429,
                });
            }

            const requestedE164 = this.normalizePhone(requestedPhone, defaultCountry);
            const match = requestedE164 === null
                ? undefined
                : uniquePhones.find(p => this.normalizePhone(p, defaultCountry) === requestedE164);

            if (!match) {
                throw new SimpleError({
                    code: 'phone_not_found',
                    message: 'The provided phone number is not linked to this member',
                    human: $t(`%Zar`),
                    statusCode: 404,
                });
            }

            phone = match;
        } else {
            // No phone number provided: cycle through the known phone numbers based on the number of previous tries.
            phone = uniquePhones[Math.abs(tryCount) % uniquePhones.length];
        }

        // Once every 5 minutes per member
        this.trackMemberLimit(member, SecurityCodeSendMethod.SMS);

        // Max 25 SMS per organization per day
        const organizationKey = member.organizationId ?? organization?.id ?? 'platform';
        try {
            smsOrganizationLimiter.track(organizationKey, 1);
        } catch (e) {
            throw new SimpleError({
                code: 'too_many_sms',
                message: 'The daily SMS limit for this organization has been reached',
                human: $t(`%Zat`),
                statusCode: 429,
            });
        }

        const code = await this.ensureSecurityCode(member);
        const formattedCode = Formatter.spaceString(code, 4, '-');

        let message = Context.user?.name && !Context.auth.hasSomePlatformAccess()
            ? $t(`%Zav`, {
                    organization: organization?.name ?? (await Platform.getShared()).config.name,
                    firstName: member.details.firstName,
                    securityCode: formattedCode,
                    user: Context.user.name,
                })
            : $t(`%Zao`, {
                    organization: organization?.name ?? (await Platform.getShared()).config.name,
                    firstName: member.details.firstName,
                    securityCode: formattedCode,
                });

        if (message.length > 160) {
            message = Context.user?.firstName && !Context.auth.hasSomePlatformAccess()
                ? $t(`%Zaz`, {
                        organization: organization?.name ?? (await Platform.getShared()).config.name,
                        firstName: member.details.firstName,
                        securityCode: formattedCode,
                        user: Context.user.firstName,
                    })
                : $t(`%Zaq`, {
                        organization: organization?.name ?? (await Platform.getShared()).config.name,
                        firstName: member.details.firstName,
                        securityCode: formattedCode,
                    });
        }

        if (message.length > 160) {
            message = Context.user?.firstName && !Context.auth.hasSomePlatformAccess()
                ? $t(`%Zb2`, {
                        organization: organization?.name ?? (await Platform.getShared()).config.name,
                        firstName: member.details.firstName,
                        securityCode: formattedCode,
                        user: Context.user.firstName,
                    })
                : $t(`%Zas`, {
                        organization: organization?.name ?? (await Platform.getShared()).config.name,
                        firstName: member.details.firstName,
                        securityCode: formattedCode,
                    });
        }

        await SMSService.send({
            to: phone,
            message,
            defaultCountry: member.details.address?.country ?? organization?.address?.country,
        });

        const maskedRecipient = this.maskPhone(phone);
        await this.logSecurityCodeRequested(member, SecurityCodeSendMethod.SMS, maskedRecipient);

        return SendMemberSecurityCodeResponse.create({
            method: SecurityCodeSendMethod.SMS,
            maskedRecipient,
        });
    }

    /**
     * Record an audit log entry so it is traceable who requested a member's security code, how and to where.
     */
    private async logSecurityCodeRequested(member: Member, method: SecurityCodeSendMethod, maskedRecipient: string) {
        const log = new AuditLog();

        // A member can belong to multiple organizations, so this is best-effort (mainly visible in the admin panel).
        log.organizationId = member.organizationId;
        log.type = AuditLogType.MemberSecurityCodeRequested;
        log.source = AuditLogSource.User;
        log.userId = Context.user?.id ?? null;
        log.objectId = member.id;
        log.replacements = new Map([
            ['m', AuditLogReplacement.create({
                value: member.details.name,
                type: AuditLogReplacementType.Member,
                id: member.id,
            })],
            ['method', AuditLogReplacement.create({
                value: method === SecurityCodeSendMethod.SMS ? 'SMS' : 'e-mail',
            })],
            ['recipient', AuditLogReplacement.create({
                value: maskedRecipient,
            })],
        ]);
        await log.save();
    }

    private trackMemberLimit(member: Member, method: SecurityCodeSendMethod) {
        try {
            if (method === SecurityCodeSendMethod.Email) {
                memberEmailSecurityCodeSendLimiter.track(member.id, 1);
            } else {
                memberSecurityCodeSendLimiter.track(member.id, 1);
            }
        } catch (e) {
            throw new SimpleError({
                code: 'too_many_requests',
                message: 'A security code was already sent for this member recently',
                human: $t(`%Zaw`),
                statusCode: 429,
            });
        }
    }

    /**
     * Normalize a phone number to E.164 for comparison, returning null when it cannot be parsed.
     */
    private normalizePhone(phone: string, defaultCountry: Country | undefined): string | null {
        try {
            return SMSService.toE164(phone, defaultCountry);
        } catch (e) {
            return null;
        }
    }

    /**
     * Return a masked version of a phone number that is safe to show to the user, e.g. "•••• 89".
     */
    private maskPhone(phone: string): string {
        const digits = phone.replace(/\D/g, '');
        const last = digits.substring(Math.max(0, digits.length - 2));
        return '•• •• ' + last;
    }
}
