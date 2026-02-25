import { User } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType } from '@stamhoofd/structures';
import { getDefaultGenerator, ModelLogger } from './ModelLogger.js';

const defaultGenerator = getDefaultGenerator({
    created: AuditLogType.UserAdded,
    updated: AuditLogType.UserEdited,
    deleted: AuditLogType.UserDeleted,
});

export const UserLogger = new ModelLogger(User, {
    skipKeys: ['meta'],
    sensitiveKeys: ['password'],
    renamedKeys: {
        memberId: 'linkedMember',
        verified: 'emailVerified',
    },
    async optionsGenerator(event) {
        const result = await defaultGenerator(event);

        if (!result) {
            return;
        }

        if (!event.model.hasAccount() && !event.model.permissions) {
            // Do not log changes to placeholder users

            if (event.type !== 'updated' || (event.originalFields.permissions === null)) {
                return;
            }
        }

        return result;
    },

    createReplacements: (model, options) => {
        return new Map([
            ['u', AuditLogReplacement.create({
                id: model.id,
                value: model.email,
                type: AuditLogReplacementType.User,
            })],
        ]);
    },
});
