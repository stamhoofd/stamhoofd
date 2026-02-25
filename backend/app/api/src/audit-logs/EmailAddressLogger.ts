import { EmailAddress } from '@stamhoofd/email';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType } from '@stamhoofd/structures';
import { ModelLogger } from './ModelLogger.js';

export const EmailAddressLogger = new ModelLogger(EmailAddress, {
    async optionsGenerator(event) {
        if (event.type === 'deleted') {
            return;
        }

        const wasUnsubscribed = event.type === 'updated' ? !!event.originalFields.unsubscribedAll : false;
        const isUnsubscribed = event.model.unsubscribedAll;

        if (!wasUnsubscribed && isUnsubscribed) {
            return {
                type: AuditLogType.EmailAddressUnsubscribed,
                data: {},
                generatePatchList: false,
            };
        }

        const wasUnsubscribedMarketing = event.type === 'updated' ? !!event.originalFields.unsubscribedMarketing : false;
        const isUnsubscribedMarketing = event.model.unsubscribedMarketing;

        if (!wasUnsubscribedMarketing && isUnsubscribedMarketing) {
            return {
                type: AuditLogType.EmailAddressUnsubscribed,
                data: {},
                generatePatchList: false,
            };
        }
    },

    createReplacements(model, options) {
        const map = new Map([
            ['e', AuditLogReplacement.create({
                id: model.id,
                value: model.email || '',
                type: AuditLogReplacementType.EmailAddress,
            })],
        ]);
        return map;
    },

});
