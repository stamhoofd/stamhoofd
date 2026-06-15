import { column, Model } from '@simonbackx/simple-database';
import { EnumDecoder } from '@simonbackx/simple-encoding';
import { PaymentStatus } from '@stamhoofd/structures';

import { AuditLogService, modelLogDefinitions } from './AuditLogService.js';

enum UnregisteredAuditLogStatus {
    Pending = 'Pending',
}

class UnregisteredAuditLogModel extends Model {
    static table = 'unregistered_audit_log_models';

    @column({ type: 'string', decoder: new EnumDecoder(UnregisteredAuditLogStatus) })
    status = UnregisteredAuditLogStatus.Pending;
}

class RegisteredAuditLogModel extends Model {
    static table = 'registered_audit_log_models';

    @column({ type: 'string', decoder: new EnumDecoder(PaymentStatus) })
    status = PaymentStatus.Pending;
}

describe('AuditLogService', () => {
    const originalModelLogDefinitions = new Map(modelLogDefinitions);

    afterEach(() => {
        modelLogDefinitions.clear();
        for (const [model, definition] of originalModelLogDefinitions) {
            modelLogDefinitions.set(model, definition);
        }
    });

    test('It throws when an audited enum column has no registered translation helper', () => {
        modelLogDefinitions.clear();
        modelLogDefinitions.set(UnregisteredAuditLogModel, {
            async logEvent() {
                // Not needed for validation.
            },
        });
        modelLogDefinitions.set(RegisteredAuditLogModel, {
            async logEvent() {
                // Not needed for validation.
            },
        });

        expect(() => AuditLogService.validateAuditLogEnumTranslations())
            .toThrow('Missing audit log enum translation registration for: UnregisteredAuditLogModel.status');
    });
});
