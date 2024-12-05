import { Email, EmailRecipient, replaceHtml } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType, EmailStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ModelLogger } from './ModelLogger';

export const EmailLogger = new ModelLogger(Email, {
    async optionsGenerator(event) {
        if (event.type === 'deleted') {
            return;
        }
        let oldStatus = EmailStatus.Draft;

        if (event.type === 'updated') {
            oldStatus = event.originalFields.status as EmailStatus;
        }

        const newStatus = event.model.status as EmailStatus;
        if (newStatus === oldStatus) {
            return;
        }

        if (newStatus !== EmailStatus.Sent && newStatus !== EmailStatus.Sending) {
            return;
        }

        if (newStatus === EmailStatus.Sent) {
            const recipient = await EmailRecipient.select().where('emailId', event.model.id).whereNot('sentAt', null).first(false);
            // Get first recipient
            return {
                type: AuditLogType.EmailSent,
                data: {
                    recipient,
                },
                generatePatchList: false,
            };
        }

        return {
            type: AuditLogType.EmailSending,
            data: {
                recipient: null,
            },
            generatePatchList: false,
        };
    },

    createReplacements(model, options) {
        const map = new Map([
            ['e', AuditLogReplacement.create({
                id: model.id,
                value: model.subject || '',
                type: AuditLogReplacementType.Email,
            })],
            ['c', AuditLogReplacement.create({
                value: Formatter.integer(model.recipientCount ?? 0),
                count: model.recipientCount ?? 0,
            })],
        ]);
        if (options.data.recipient) {
            map.set('html', AuditLogReplacement.html(
                replaceHtml(model.html ?? '', options.data.recipient?.replacements ?? []),
            ));
        }
        return map;
    },

});
