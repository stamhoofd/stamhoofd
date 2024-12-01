import { Order, Webshop } from '@stamhoofd/models';
import { getDefaultGenerator, ModelLogger } from './ModelLogger';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType } from '@stamhoofd/structures';

const defaultGenerator = getDefaultGenerator({
    created: AuditLogType.OrderAdded,
    updated: AuditLogType.OrderEdited,
    deleted: AuditLogType.OrderDeleted,
});

export const OrderLogger = new ModelLogger(Order, {
    skipKeys: ['amount', 'timeSlotTime'],
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
                description: model.data.customer.name,
            })],
        ]);
    },
});
