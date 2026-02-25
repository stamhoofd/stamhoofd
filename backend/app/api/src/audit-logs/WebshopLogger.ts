import { Webshop } from '@stamhoofd/models';
import { getDefaultGenerator, ModelLogger } from './ModelLogger.js';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType } from '@stamhoofd/structures';

const defaultGenerator = getDefaultGenerator({
    created: AuditLogType.WebshopAdded,
    updated: AuditLogType.WebshopEdited,
    deleted: AuditLogType.WebshopDeleted,
});

export const WebshopLogger = new ModelLogger(Webshop, {
    skipKeys: [],
    async optionsGenerator(event) {
        const result = await defaultGenerator(event);

        if (!result) {
            return;
        }

        // todo: when placing an order / marking an order as paid
        // we should not log any stock changes

        return result;
    },

    createReplacements: (model) => {
        return new Map([
            ['w', AuditLogReplacement.create({
                id: model.id,
                value: model.meta.name,
                type: AuditLogReplacementType.Webshop,
            })],
        ]);
    },
});
