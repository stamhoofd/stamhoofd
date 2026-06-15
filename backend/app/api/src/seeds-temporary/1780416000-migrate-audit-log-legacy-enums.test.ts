import { AuditLog } from '@stamhoofd/models';
import { AuditLogPatchItem, AuditLogReplacement, AuditLogReplacementType, EventNotificationStatus, getLegacyAuditLogEnumRegistrations, getLegacyAuditLogEnumReplacement } from '@stamhoofd/structures';

import { migrateAuditLogLegacyEnums } from './1780416000-migrate-audit-log-legacy-enums.js';

describe('Seed.migrate-audit-log-legacy-enums', () => {
    test('It converts all legacy enum audit log values without changing their rendered names', () => {
        let migratedValues = 0;

        for (const registration of getLegacyAuditLogEnumRegistrations()) {
            for (const value of Object.values(registration.enumObject)) {
                if (typeof value !== 'string') {
                    continue;
                }

                if (!getLegacyAuditLogEnumReplacement(value)) {
                    continue;
                }

                const legacyReplacement = AuditLogReplacement.key(value);
                const legacyName = legacyReplacement.toString();
                const log = new AuditLog();
                log.replacements = new Map([
                    ['value', legacyReplacement.clone()],
                ]);
                log.patchList = [
                    AuditLogPatchItem.create({
                        key: legacyReplacement.clone(),
                        oldValue: legacyReplacement.clone(),
                        value: legacyReplacement.clone(),
                    }),
                ];

                expect(migrateAuditLogLegacyEnums(log)).toBe(true);

                const replacement = log.replacements.get('value');
                expect(replacement?.type).toBe(AuditLogReplacementType.Enum);
                expect(replacement?.toString()).toBe(legacyName);

                expect(log.patchList[0].key.type).toBe(AuditLogReplacementType.Enum);
                expect(log.patchList[0].key.toString()).toBe(legacyName);
                expect(log.patchList[0].oldValue?.type).toBe(AuditLogReplacementType.Enum);
                expect(log.patchList[0].oldValue?.toString()).toBe(legacyName);
                expect(log.patchList[0].value?.type).toBe(AuditLogReplacementType.Enum);
                expect(log.patchList[0].value?.toString()).toBe(legacyName);
                migratedValues += 1;
            }
        }

        expect(migratedValues).toBeGreaterThan(0);
    });

    test('It does not migrate event notification statuses through the legacy mapping', () => {
        expect(getLegacyAuditLogEnumRegistrations().some(({ type }) => type === 'EventNotificationStatus')).toBe(false);

        const legacyReplacement = AuditLogReplacement.key(EventNotificationStatus.Accepted);
        const log = new AuditLog();
        log.replacements = new Map([
            ['value', legacyReplacement],
        ]);

        expect(migrateAuditLogLegacyEnums(log)).toBe(false);

        expect(log.replacements.get('value')).toMatchObject({
            value: EventNotificationStatus.Accepted,
            type: AuditLogReplacementType.Key,
        });
    });
});
