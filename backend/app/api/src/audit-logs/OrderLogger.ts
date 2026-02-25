import { Order, Webshop } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType, OrderStatus } from '@stamhoofd/structures';
import { getDefaultGenerator, ModelLogger } from './ModelLogger.js';

const defaultGenerator = getDefaultGenerator({
    created: AuditLogType.OrderAdded,
    updated: AuditLogType.OrderEdited,
    deleted: AuditLogType.OrderDeleted,
});

export const OrderLogger = new ModelLogger(Order, {
    skipKeys: ['amount', 'timeSlotTime', 'validAt', 'paymentId'],
    async optionsGenerator(event) {
        const result = await defaultGenerator(event);

        if (!result) {
            return;
        }

        // todo: when placing an order / marking an order as paid
        // we should not log any stock changes

        const webshop = Order.webshop.isLoaded(event.model) ? (event.model as (Order & Record<'webshop', Webshop>)).webshop : (await Webshop.getByID(event.model.webshopId));
        if (!webshop) {
            console.log('No webshop found for order', event.model.id);
            return;
        }

        if (event.type === 'updated' && event.changedFields.status === OrderStatus.Deleted) {
            result.type = AuditLogType.OrderDeleted;
            result.generatePatchList = false;
        }

        return {
            ...result,
            data: {
                webshop,
            },
        };
    },

    createReplacements: (model, options) => {
        return new Map([
            ['w', AuditLogReplacement.create({
                id: options.data.webshop.id,
                value: options.data.webshop.meta.name,
                type: AuditLogReplacementType.Webshop,
            })],
            ['o', AuditLogReplacement.create({
                id: model.id,
                value: model.number ? `bestelling #${model.number}` : `bestelling van ${model.data.customer.name}`,
                type: AuditLogReplacementType.Order,
                description: model.number ? model.data.customer.name : $t(`4597a3f5-6a6a-44a3-85da-5240ab08447a`),
            })],
        ]);
    },
});
