import { AuditLogReplacement, PaymentStatus } from '@stamhoofd/structures';

describe('AuditLogReplacement', () => {
    test('It renders typed enum replacements', () => {
        const paymentStatus = AuditLogReplacement.enum('PaymentStatus', PaymentStatus.Pending);

        expect(paymentStatus?.toString()).toBe('%mu');
    });
});
