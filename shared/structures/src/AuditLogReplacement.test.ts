import { AuditLogReplacement, EventNotificationStatus, PaymentStatus } from '@stamhoofd/structures';

describe('AuditLogReplacement', () => {
    test('It renders typed enum replacements without conflicts', () => {
        const eventNotificationStatus = AuditLogReplacement.enum('EventNotificationStatus', EventNotificationStatus.Pending);
        const paymentStatus = AuditLogReplacement.enum('PaymentStatus', PaymentStatus.Pending);

        expect(eventNotificationStatus?.toString()).toBe('%B0');
        expect(paymentStatus?.toString()).toBe('%mu');
    });
});
