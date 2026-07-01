import type { User } from '@stamhoofd/models';
import { AuditLog } from '@stamhoofd/models';
import type { MFAMethodType } from '@stamhoofd/structures';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogSource, AuditLogType } from '@stamhoofd/structures';

/**
 * Records the changes a user makes to their own two-factor authentication.
 *
 * These are security-relevant events that are not visible anywhere else: the credentials
 * themselves are not audit-logged models, and an attacker who took over a session would
 * use exactly these endpoints to lock the owner out. So they are logged explicitly, at the
 * moment the change is effective.
 */
export class TwoFactorAuditLogService {
    static async logMethodAdded(user: User, method: MFAMethodType, name: string) {
        await this.save(AuditLogType.UserTwoFactorMethodAdded, user, method, name);
    }

    static async logMethodDeleted(user: User, method: MFAMethodType, name: string) {
        await this.save(AuditLogType.UserTwoFactorMethodDeleted, user, method, name);
    }

    /**
     * Only for an explicit regeneration by the user. The batch that is generated together
     * with a first factor is already covered by the method-added log.
     */
    static async logRecoveryCodesRegenerated(user: User) {
        await this.save(AuditLogType.UserRecoveryCodesRegenerated, user, null, '');
    }

    private static async save(type: AuditLogType, user: User, method: MFAMethodType | null, name: string) {
        const log = new AuditLog();
        log.type = type;
        log.source = AuditLogSource.User;

        // A user changes their own factors, so the account is both the actor and the subject.
        log.userId = user.id;
        log.objectId = user.id;

        // Deliberately the organization of the account itself, not the one the request was
        // scoped to: a platform administrator enrolling a factor while working in an
        // organization is not that organization's business.
        log.organizationId = user.organizationId;

        log.replacements = new Map([
            ['u', AuditLogReplacement.create({
                id: user.id,
                value: user.email,
                type: AuditLogReplacementType.User,
            })],
        ]);

        const methodReplacement = AuditLogReplacement.enum('MFAMethodType', method);
        if (methodReplacement) {
            log.replacements.set('method', methodReplacement);
        }

        if (name) {
            log.replacements.set('name', AuditLogReplacement.string(name));
        }

        await log.save();
    }
}
