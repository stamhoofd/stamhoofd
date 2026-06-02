import { Migration } from '@simonbackx/simple-database';
import { AuditLog } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, getLegacyAuditLogEnumReplacement } from '@stamhoofd/structures';

export function migrateAuditLogReplacementLegacyEnums(replacement: AuditLogReplacement | undefined): { replacement: AuditLogReplacement | undefined; changed: boolean } {
    if (!replacement) {
        return { replacement, changed: false };
    }

    if (replacement.type === AuditLogReplacementType.Key) {
        const migrated = getLegacyAuditLogEnumReplacement(replacement.value);
        if (migrated) {
            return { replacement: migrated, changed: true };
        }
    }

    if (replacement.type === AuditLogReplacementType.Array) {
        let changed = false;
        const values = replacement.values.map((value) => {
            const result = migrateAuditLogReplacementLegacyEnums(value);
            changed ||= result.changed;
            return result.replacement ?? value;
        });

        if (changed) {
            const clone = replacement.clone();
            clone.values = values;
            return { replacement: clone, changed: true };
        }
    }

    return { replacement, changed: false };
}

export function migrateAuditLogLegacyEnums(log: AuditLog): boolean {
    let changed = false;

    for (const [key, replacement] of log.replacements) {
        const result = migrateAuditLogReplacementLegacyEnums(replacement);
        if (result.changed && result.replacement) {
            log.replacements.set(key, result.replacement);
            changed = true;
        }
    }

    for (const item of log.patchList) {
        const key = migrateAuditLogReplacementLegacyEnums(item.key);
        if (key.changed && key.replacement) {
            item.key = key.replacement;
            changed = true;
        }

        const oldValue = migrateAuditLogReplacementLegacyEnums(item.oldValue);
        if (oldValue.changed) {
            item.oldValue = oldValue.replacement;
            changed = true;
        }

        const value = migrateAuditLogReplacementLegacyEnums(item.value);
        if (value.changed) {
            item.value = value.replacement;
            changed = true;
        }
    }

    return changed;
}

export default new Migration(async () => {
    console.log('Start migrating legacy audit log enum replacements.');

    const batchSize = 100;
    let count = 0;

    for await (const log of AuditLog.select().limit(batchSize).all()) {
        if (!migrateAuditLogLegacyEnums(log)) {
            continue;
        }

        await log.save();
        count += 1;
    }

    console.log('Finished migrating legacy audit log enum replacements for ' + count + ' audit logs.');
});
