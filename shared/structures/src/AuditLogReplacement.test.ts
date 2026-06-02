import { AuditLogReplacement, AuditLogReplacementDependencies, AuditLogReplacementType, EventNotificationStatus, PaymentStatus, getAuditLogPatchKeyName, getRegisteredAuditLogEnums } from '@stamhoofd/structures';

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
});
