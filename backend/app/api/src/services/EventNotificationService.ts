import { SimpleError } from '@simonbackx/simple-errors';
import { EventNotification, Member, MemberResponsibilityRecord, Organization, Platform, sendEmailTemplate, User } from '@stamhoofd/models';
import { EmailTemplateType, PermissionLevel, Recipient, RecordCategory, Replacement } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { AdminPermissionChecker } from '../helpers/AdminPermissionChecker.js';
import { Context } from '../helpers/Context.js';
import { AuthenticatedStructures } from '../helpers/AuthenticatedStructures.js';

export class EventNotificationService {
    static async validateType(notification: EventNotification) {
        const platform = await Platform.getSharedPrivateStruct();
        const type = platform.config.eventNotificationTypes.find(t => t.id === notification.typeId);

        if (!type) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid type',
                human: Context.i18n.$t('4d8be2b1-559a-4c16-a76f-67a8ba85de7f'),
                field: 'typeId',
            });
        }

        return type;
    }

    static async cleanAnswers(notification: EventNotification) {
        const type = await this.validateType(notification);
        const struct = await AuthenticatedStructures.eventNotification(notification);
        const patchedStruct = RecordCategory.removeOldAnswers(type.recordCategories, struct);
        notification.recordAnswers = patchedStruct.getRecordAnswers();
    }

    static async getSubmitterRecipients(notification: EventNotification): Promise<Recipient[]> {
        // Send the email to all users with full permissions + the submitter + the creator
        const type = await this.validateType(notification);
        const responsibilityIds = type.contactResponsibilityIds;
        const organizationId = notification.organizationId;
        const platform = await Platform.getSharedPrivateStruct();

        const recipients: Recipient[] = [];

        if (responsibilityIds.length) {
            // Query all users with the responsibility
            const records = await MemberResponsibilityRecord.select()
                .where('organizationId', organizationId)
                .andWhere('responsibilityId', responsibilityIds)
                .andWhere(MemberResponsibilityRecord.whereActive)
                .fetch();
            const memberIds = records.map(r => r.memberId);
            const members = await Member.getByIDs(...memberIds);

            for (const member of members) {
                if (!member.details.email) {
                    continue;
                }
                recipients.push(Recipient.create({
                    firstName: member.details.firstName,
                    lastName: member.details.lastName,
                    email: member.details.email,
                }));
            }
        }

        if (notification.submittedBy) {
            const user = await User.getByID(notification.submittedBy);
            if (user && user.verified) {
                const p = new AdminPermissionChecker(user, platform);

                if (await p.canAccessEventNotification(notification, PermissionLevel.Write)) {
                    recipients.push(Recipient.create({
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                    }));
                }
            }
        }

        if (notification.createdBy) {
            const user = await User.getByID(notification.createdBy);
            if (user && user.verified) {
                const p = new AdminPermissionChecker(user, platform);

                if (await p.canAccessEventNotification(notification, PermissionLevel.Write)) {
                    recipients.push(Recipient.create({
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                    }));
                }
            }
        }

        // Remove duplicates
        const emails = new Set<string>();
        const filteredRecipients: Recipient[] = [];
        for (const recipient of recipients) {
            if (!emails.has(recipient.email)) {
                emails.add(recipient.email);
                filteredRecipients.push(recipient);
            }
        }

        return filteredRecipients;
    }

    static async getReviewerRecipients(notification: EventNotification): Promise<Recipient[]> {
        // Find all users that have permission to review this notification
        const platformAdmins = await User.getPlatformAdmins();
        const recipients: Recipient[] = [];
        const platform = await Platform.getSharedPrivateStruct();

        for (const user of platformAdmins) {
            const p = new AdminPermissionChecker(user, platform);

            if (await p.canReviewEventNotification(notification)) {
                recipients.push(Recipient.create({
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                }));
            }
        }

        return recipients;
    }

    static async getEmailReplacements(notification: EventNotification, forReviewers = false) {
        const organization = await Organization.getByID(notification.organizationId);
        if (!organization) {
            throw new Error('Organization not found');
        }
        const events = EventNotification.events.isLoaded(notification) ? notification.events : await EventNotification.events.load(notification);
        const type = await this.validateType(notification);
        let submitterName = $t(`95c51d5c-0945-4fcf-90e9-764940e7f54d`);

        if (notification.submittedBy) {
            const user = await User.getByID(notification.submittedBy);
            if (user) {
                submitterName = user.name ?? user.email;
            }
        }

        return [
            Replacement.create({
                token: 'eventName',
                value: events.map(e => e.name).join(', '),
            }),
            Replacement.create({
                token: 'organizationName',
                value: organization.name,
            }),
            Replacement.create({
                token: 'reviewUrl',
                value: forReviewers ? Context.i18n.localizedDomains.adminUrl() + '/kampmeldingen/' + encodeURIComponent(notification.id) : (events.length === 0 ? organization.getBaseStructure().dashboardUrl : (organization.getBaseStructure().dashboardUrl + '/activiteiten/' + events[0].id + '/' + Formatter.slug(type.title))),
            }),
            Replacement.create({
                token: 'dateRange',
                value: Formatter.dateRange(notification.startDate, notification.endDate, undefined, false),
            }),
            Replacement.create({
                token: 'submitterName',
                value: submitterName,
            }),
            Replacement.create({
                token: 'feedbackText',
                html: notification.feedbackText ? `<p class="pre-wrap"><em>${Formatter.escapeHtml(notification.feedbackText)}</em></p>` : `<p class="pre-wrap"><em>${Formatter.escapeHtml($t('4c3149b3-e02a-4071-bf21-941711e0238d'))}</em></p>`,
            }),
        ];
    }

    static async sendSubmitterEmail(type: EmailTemplateType, notification: EventNotification) {
        if (notification.endDate < new Date()) {
            console.log('Skipped submitter email because it is in the past');
            // Ignore
            return;
        }
        await sendEmailTemplate(null, {
            recipients: await this.getSubmitterRecipients(notification),
            template: {
                type,
            },
            defaultReplacements: await this.getEmailReplacements(notification),
            type: 'transactional',
        });
    }

    static async sendReviewerEmail(type: EmailTemplateType, notification: EventNotification) {
        if (notification.endDate < new Date()) {
            console.log('Skipped reviewer email because it is in the past');

            // Ignore
            return;
        }
        await sendEmailTemplate(null, {
            recipients: await this.getReviewerRecipients(notification),
            template: {
                type,
            },
            defaultReplacements: await this.getEmailReplacements(notification, true),
            type: 'transactional',
        });
    }
};
