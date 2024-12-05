import { Email } from '@stamhoofd/models';
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

        if (newStatus === EmailStatus.Sent) {
            return {
                type: AuditLogType.EmailSent,
                data: {},
                generatePatchList: false,
            };
        }

        if (newStatus === EmailStatus.Sending) {
            return {
                type: AuditLogType.EmailSending,
                data: {},
                generatePatchList: false,
            };
        }
        return;
    },

    createReplacements(model) {
        return new Map([
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
    },
});
