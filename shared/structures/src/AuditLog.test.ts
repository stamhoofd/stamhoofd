import { AuditLog, AuditLogReplacement, AuditLogReplacementType, AuditLogSource, AuditLogType, MFAMethodType, getAuditLogTypeIcon, getAuditLogTypeName } from '#/index.ts';

function twoFactorLog(type: AuditLogType, replacements: Record<string, AuditLogReplacement>): AuditLog {
    return AuditLog.create({
        id: 'e5d1e4ac-0f5e-4a5e-9b09-3a3a7a1f9a11',
        source: AuditLogSource.User,
        type,
        user: null,
        createdAt: new Date(2026, 0, 1),
        replacements: new Map([
            ['u', AuditLogReplacement.create({
                id: '00000000-0000-4000-8000-000000000000',
                value: 'admin@example.com',
                type: AuditLogReplacementType.User,
            })],
            ...Object.entries(replacements),
        ]),
    });
}

describe('AuditLog', () => {
    test.skip('It renders the title of a two-factor method that was added or deleted', () => {
        const added = twoFactorLog(AuditLogType.UserTwoFactorMethodAdded, {
            method: AuditLogReplacement.enum('MFAMethodType', MFAMethodType.TOTP)!,
            name: AuditLogReplacement.string('GSM van Jan'),
        });
        expect(added.title).toBe('Authenticator-app ‘GSM van Jan’ werd toegevoegd als tweestapsverificatie van admin@example.com');

        const deleted = twoFactorLog(AuditLogType.UserTwoFactorMethodDeleted, {
            method: AuditLogReplacement.enum('MFAMethodType', MFAMethodType.Passkey)!,
        });
        // The name is optional: a passkey does not have to be named.
        expect(deleted.title).toBe('Passkey werd verwijderd als tweestapsverificatie van admin@example.com');
    });

    test.skip('It renders the title of regenerated recovery codes', () => {
        const log = twoFactorLog(AuditLogType.UserRecoveryCodesRegenerated, {});
        expect(log.title).toBe('De herstelcodes van admin@example.com werden opnieuw gegenereerd');
    });

    test('Every type has a name and an icon', () => {
        for (const type of Object.values(AuditLogType)) {
            expect(getAuditLogTypeName(type), type).toBeTruthy();
            expect(getAuditLogTypeIcon(type)[0], type).toBeTruthy();
        }
    });
});
