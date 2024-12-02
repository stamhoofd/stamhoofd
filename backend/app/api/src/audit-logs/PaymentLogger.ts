import { Payment } from '@stamhoofd/models';
import { AuditLogType } from '@stamhoofd/structures';
import { getDefaultGenerator, ModelLogger } from './ModelLogger';

export const PaymentLogger = new ModelLogger(Payment, {
    optionsGenerator: getDefaultGenerator({
        created: AuditLogType.PaymentAdded,
        updated: AuditLogType.PaymentEdited,
        deleted: AuditLogType.PaymentDeleted,
    }),
});
