import { AuditLogReplacement, AuditLogReplacementDependencies, AuditLogReplacementType, EventNotificationStatus, PaymentStatus, getAuditLogPatchKeyName, getRegisteredAuditLogEnums, registerAuditLogEnum } from '@stamhoofd/structures';

enum TestAuditLogStatus {
    Pending = 'Pending',
}

describe('AuditLogReplacement', () => {
    test('It renders typed enum replacements without conflicts', () => {
        const eventNotificationStatus = AuditLogReplacement.enum('EventNotificationStatus', EventNotificationStatus.Pending);
        const paymentStatus = AuditLogReplacement.enum('PaymentStatus', PaymentStatus.Pending);

        expect(eventNotificationStatus?.toString()).toBe('%B0');
        expect(paymentStatus?.toString()).toBe('%mu');
    });

    test('It registers typed enum helpers for legacy enum replacements', () => {
        expect(getRegisteredAuditLogEnums().map(({ type }) => type).sort()).toEqual([
            'AccessRight',
            'CheckoutMethodType',
            'Country',
            'DocumentStatus',
            'EmailTemplateType',
            'EventNotificationStatus',
            'Gender',
            'GroupStatus',
            'OrderStatus',
            'OrganizationType',
            'ParentType',
            'PaymentMethod',
            'PaymentStatus',
            'STPackageType',
            'SetupStepType',
            'UmbrellaOrganization',
        ]);

        expect(getAuditLogPatchKeyName(PaymentStatus.Pending)).toBe('%mu');
        expect(AuditLogReplacement.create({ value: PaymentStatus.Pending, type: AuditLogReplacementType.Key }).toString()).toBe('%mu');
        expect(AuditLogReplacementDependencies.enumHelpers).toHaveLength(getRegisteredAuditLogEnums().length - 1);
        expect(AuditLogReplacement.enum('EventNotificationStatus', EventNotificationStatus.Accepted)?.toString()).toBe('%B1');
    });

    test('It throws when registering duplicate audit log enums', () => {
        const enumHelpersLength = AuditLogReplacementDependencies.enumHelpers.length;
        const legacyEnumsLength = AuditLogReplacementDependencies.legacyEnums.length;

        registerAuditLogEnum('TestAuditLogStatus', TestAuditLogStatus, key => key);

        expect(() => registerAuditLogEnum('TestAuditLogStatus', { Other: 'Other' }, key => key))
            .toThrow('Audit log enum type is already registered: TestAuditLogStatus');

        expect(() => registerAuditLogEnum('OtherTestAuditLogStatus', TestAuditLogStatus, key => key))
            .toThrow('Audit log enum object is already registered: TestAuditLogStatus');

        AuditLogReplacementDependencies.enumHelpersByType.delete('TestAuditLogStatus');
        AuditLogReplacementDependencies.enumTypes.delete(TestAuditLogStatus);
        AuditLogReplacementDependencies.enumHelpers.length = enumHelpersLength;
        AuditLogReplacementDependencies.legacyEnums.length = legacyEnumsLength;
    });
});
