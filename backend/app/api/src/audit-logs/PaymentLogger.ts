import { Payment } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType, PaymentMethod, PaymentMethodHelper, PaymentStatusHelper } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { getDefaultGenerator, ModelLogger } from './ModelLogger.js';

export const PaymentLogger = new ModelLogger(Payment, {
    skipKeys: ['transferFee'],

    optionsGenerator: getDefaultGenerator({
        created: AuditLogType.PaymentAdded,
        updated: AuditLogType.PaymentEdited,
        deleted: AuditLogType.PaymentDeleted,
    }),

    generateDescription(event, options) {
        if (event.type === 'created') {
            let description = `Status: ${PaymentStatusHelper.getNameCapitalized(event.model.status)}\n`
                + `Bedrag: ${Formatter.price(event.model.price)}`;

            if (event.model.method === PaymentMethod.Transfer && event.model.transferDescription) {
                description += `\nMededeling: ${event.model.transferDescription}`;
            }

            return description;
        }
    },

    createReplacements(model, options) {
        let name = `${PaymentMethodHelper.getPaymentName(model.method, model.type)}`;

        if (model.customer?.dynamicName) {
            name += ` van ${model.customer.dynamicName}`;
        }

        return new Map([
            ['p', AuditLogReplacement.create({
                id: model.id,
                value: name,
                type: AuditLogReplacementType.Payment,
            })],
        ]);
    },
});
