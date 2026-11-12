import type { DataRetentionPolicy, User } from '@stamhoofd/models';
import { AuditLog } from '@stamhoofd/models';
import type { DataRetentionTerms } from '@stamhoofd/structures';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogSource, AuditLogType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

/**
 * These logs have to prove who decided what, also after the account of that administrator is gone
 * (audit_logs.userId is cleared when the user is deleted). So the name and email are stored in the log itself.
 */
export class DataRetentionAuditLogService {
    static async logPolicyChanged(user: User, policy: DataRetentionPolicy, before: DataRetentionTerms, after: DataRetentionTerms, from: Date) {
        const log = this.create(AuditLogType.DataRetentionPolicyChanged, user, policy);
        log.replacements.set('before', AuditLogReplacement.string(before.getDescription()));
        log.replacements.set('after', AuditLogReplacement.string(after.getDescription()));
        log.replacements.set('from', AuditLogReplacement.string(Formatter.dateTime(from)));
        await log.save();
    }

    static async logPendingChangeCancelled(user: User, policy: DataRetentionPolicy, cancelled: DataRetentionTerms) {
        const log = this.create(AuditLogType.DataRetentionPendingChangeCancelled, user, policy);
        log.replacements.set('after', AuditLogReplacement.string(cancelled.getDescription()));
        await log.save();
    }

    private static create(type: AuditLogType, user: User, policy: DataRetentionPolicy): AuditLog {
        const log = new AuditLog();
        log.type = type;
        log.source = AuditLogSource.User;
        log.userId = user.id;
        log.objectId = policy.id;
        log.organizationId = policy.organizationId;
        log.replacements = new Map([
            ['u', AuditLogReplacement.create({
                id: user.id,
                value: user.name ? `${user.name} (${user.email})` : user.email,
                type: AuditLogReplacementType.User,
            })],
            ['category', AuditLogReplacement.enum('DataRetentionCategory', policy.category)!],
        ]);
        return log;
    }
}
