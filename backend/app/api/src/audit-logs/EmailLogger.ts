import { Email } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType, EmailStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ModelLogger } from './ModelLogger.js';

export const EmailLogger = new ModelLogger(Email, {
    skipKeys: ['json', 'text', 'status', 'userId', 'createdAt', 'updatedAt', 'deletedAt', 'recipientFilter', 'emailRecipientsCount', 'otherRecipientsCount', 'succeededCount', 'softFailedCount', 'failedCount', 'membersCount', 'hardBouncesCount', 'softBouncesCount', 'spamComplaintsCount', 'recipientsStatus', 'recipientsErrors', 'emailErrors', 'sentAt'],

    async optionsGenerator(event) {
        let oldStatus = EmailStatus.Draft;

        if (event.type === 'updated') {
            oldStatus = event.originalFields.status as EmailStatus;
        }

        if (event.type === 'deleted' || (event.type === 'updated' && event.model.deletedAt && !event.getOldModel().deletedAt)) {
            return {
                type: AuditLogType.EmailDeleted,
                data: {
                },
                generatePatchList: false,
            };
        }

        const newStatus = event.model.status as EmailStatus;
        if (newStatus === oldStatus || (newStatus !== EmailStatus.Sent && newStatus !== EmailStatus.Sending)) {
            if (newStatus === EmailStatus.Draft) {
                return;
            }
            return {
                type: AuditLogType.EmailEdited,
                data: {
                },
                generatePatchList: true,
            };
        }

        if (newStatus === EmailStatus.Sent) {
            return {
                type: event.model.sendAsEmail ? AuditLogType.EmailSent : AuditLogType.EmailPublished,
                data: {
                },
                generatePatchList: false,
            };
        }

        if (event.model.emailType || !event.model.sendAsEmail) {
            // don't log the scheduled part of automated emails
            return;
        }

        return {
            type: AuditLogType.EmailSending,
            data: {
            },
            generatePatchList: false,
        };
    },

    createReplacements(model, options) {
        const map = new Map([
            ['e', AuditLogReplacement.create({
                id: model.id,
                value: model.subject ?? '',
                type: AuditLogReplacementType.Email,
            })],
            ['c', AuditLogReplacement.create({
                value: Formatter.integer(model.emailRecipientsCount ?? 0),
                count: model.emailRecipientsCount ?? 0,
            })],
        ]);
        if (model.html) {
            map.set('html', AuditLogReplacement.html(model.html));
        }
        return map;
    },

});
