import { Model, ModelEvent } from '@simonbackx/simple-database';
import { AuditLog } from '@stamhoofd/models';
import { ObjectDiffer } from '@stamhoofd/object-differ';
import { AuditLogPatchItem, AuditLogPatchItemType, AuditLogReplacement, AuditLogSource, AuditLogType } from '@stamhoofd/structures';
import { ContextInstance } from '../helpers/Context.js';
import { AuditLogService } from '../services/AuditLogService.js';

export type ModelEventLogOptions<D> = {
    type: AuditLogType;
    generatePatchList?: boolean;
    data: D;
    mergeInto?: AuditLog;
    objectId?: string;
};

type DefaultLogOptionsType = {
    created?: AuditLogType;
    updated?: AuditLogType;
    deleted?: AuditLogType;
};

type EventOptionsGenerator<M extends Model, D> = (event: ModelEvent<M>) => ModelEventLogOptions<D> | Promise<ModelEventLogOptions<D> | undefined> | undefined;

export type ModelLoggerOptions<M extends Model, D = undefined> = {
    optionsGenerator: EventOptionsGenerator<M, D>;
    skipKeys?: string[];
    sensitiveKeys?: string[];
    renamedKeys?: Record<string, string>;
    generateDescription?(event: ModelEvent<M>, options: ModelEventLogOptions<D>): string | null | undefined;
    createReplacements?(model: M, options: ModelEventLogOptions<D>): Map<string, AuditLogReplacement>;
    postProcess?(event: ModelEvent<M>, options: ModelEventLogOptions<D>, log: AuditLog): Promise<void> | void;
};

const ModelEventsMap = new WeakMap<Model, { events: AuditLog[] }>();

export function getDefaultGenerator<M extends Model = Model>(types: DefaultLogOptionsType): EventOptionsGenerator<M, { model: M }> {
    return (event: ModelEvent<M>) => {
        if (event.type === 'created') {
            if (types.created) {
                return { type: types.created, data: { model: event.model } };
            }
            return;
        }

        let mergeInto: AuditLog | undefined = undefined;

        if (event.type === 'updated') {
            // Generate changes list
            if ('deletedAt' in event.changedFields && ((event.model as any).deletedAt)) {
                if (!('deletedAt' in event.originalFields) || !event.originalFields.deletedAt) {
                    event = {
                        ...event,
                        type: 'deleted',
                    };

                    if (types.deleted) {
                        return { type: types.deleted, data: { model: event.model } };
                    }
                }
            }

            if (types.updated) {
                if ('createdAt' in event.model && event.model.createdAt instanceof Date && event.model.createdAt.getTime() >= Date.now() - 1000) {
                    // Ignore quick model changes after insertion: these are often side effects of code that should not be logged
                    // (the created event normally doesn't contain what has been added - so no need to log what has been changed since creation)
                    if (types.created && types.created !== types.updated) {
                        // Merge into create event
                        const events = ModelEventsMap.get(event.model)?.events;
                        if (events && events.length > 0) {
                            mergeInto = events.find(e => e.type === types.created);
                        }
                    }
                }

                return { type: types.updated, generatePatchList: true, data: { model: event.model }, mergeInto };
            }
            return;
        }

        if (event.type === 'deleted') {
            if (types.deleted) {
                return { type: types.deleted, data: { model: event.model } };
            }
            return;
        }
    };
}

export class ModelLogger<ModelType extends typeof Model, M extends InstanceType<ModelType>, D> {
    model: ModelType;
    optionsGenerator: EventOptionsGenerator<M, D>;
    skipKeys: string[] = [];
    sensitiveKeys: string[] = [];
    renamedKeys: Record<string, string> = {};
    generateDescription?: (event: ModelEvent<M>, options: ModelEventLogOptions<D>) => string | null | undefined;
    createReplacements?: (model: M, options: ModelEventLogOptions<D>) => Map<string, AuditLogReplacement>;
    postProcess?: (event: ModelEvent<M>, options: ModelEventLogOptions<D>, log: AuditLog) => Promise<void> | void;
    static sharedSkipKeys = ['id', 'createdAt', 'updatedAt', 'deletedAt'];
    static sharedSensitiveKeys = ['password'];

    constructor(model: ModelType, options: ModelLoggerOptions<M, D>) {
        this.model = model;
        this.optionsGenerator = options.optionsGenerator;
        this.skipKeys = options.skipKeys ?? [];
        this.generateDescription = options.generateDescription;
        this.createReplacements = options.createReplacements;
        this.postProcess = options.postProcess;
        this.sensitiveKeys = options.sensitiveKeys ?? [];
        this.renamedKeys = options.renamedKeys ?? {};
    }

    async logEvent(event: ModelEvent<M>) {
        const log = new AuditLog();
        try {
            const context = ContextInstance.optional;
            let settings = AuditLogService.getContext();
            let userId = settings?.userId !== undefined ? settings?.userId : (context?.optionalAuth?.user?.id ?? settings?.fallbackUserId ?? null);

            if (userId === '1') {
                // System user
                userId = null;

                if (!settings?.source) {
                    if (settings) {
                        settings.source = AuditLogSource.System;
                    }
                    else {
                        settings = { source: AuditLogSource.System };
                    }
                }
            }

            const options = await this.optionsGenerator(event);

            if (!options) {
                return false;
            }
            log.userId = userId;

            log.organizationId = context?.organization?.id ?? settings?.fallbackOrganizationId ?? null;

            if ('organizationId' in event.model && typeof event.model['organizationId'] === 'string') {
                // Always override
                log.organizationId = event.model.organizationId;
            }

            if (settings?.source) {
                log.source = settings.source;
            }
            else if (context) {
                log.source = userId ? AuditLogSource.User : AuditLogSource.Anonymous;
            }
            else {
                log.source = AuditLogSource.System;
            }

            log.type = options.type;
            log.objectId = options.objectId ?? event.model.getPrimaryKey()?.toString() ?? null;
            log.replacements = this.createReplacements ? this.createReplacements(event.model as M, options) : new Map();
            log.description = (this.generateDescription ? this.generateDescription(event, options) : '') ?? '';

            if (options.generatePatchList && event.type === 'updated') {
                const oldModel = event.getOldModel();

                // Generate changes list
                const changedProperties = Object.keys(event.changedFields).filter(k => !this.skipKeys?.includes(k) && !ModelLogger.sharedSkipKeys.includes(k));

                if (changedProperties.length > 0) {
                    for (const key of changedProperties) {
                        if (changedProperties[key] instanceof Model) {
                            // Ignore relations
                            continue;
                        }
                        const renamedKey = this.renamedKeys?.[key] ?? key;
                        if (ModelLogger.sharedSensitiveKeys.includes(key) || (this.skipKeys && this.skipKeys.includes(key))) {
                            log.patchList.push(AuditLogPatchItem.create({
                                key: AuditLogReplacement.key(renamedKey),
                                type: AuditLogPatchItemType.Changed,
                            }));
                        }
                        else {
                            log.patchList.push(...ObjectDiffer.diff(
                                key in oldModel ? oldModel[key] : undefined,
                                key in event.model ? event.model[key] : undefined,
                                AuditLogReplacement.key(renamedKey),
                            ));
                        }
                    }

                    // Remove skipped keys
                    log.patchList = log.patchList.filter(p => !this.skipKeys?.includes(p.key.toKey()));

                    if (log.patchList.length === 0 && !log.description) {
                        // No changes or all skipped
                        return false;
                    }
                }
                else {
                    return false;
                }
            }

            if (this.postProcess) {
                await this.postProcess(event, options, log);
            }

            if (options.mergeInto) {
                // Merge into
                console.log('Merging new audit log into existing log', options.mergeInto.id);

                if (!options.mergeInto.description) {
                    options.mergeInto.description = log.description;
                }

                if (log.replacements.size) {
                    options.mergeInto.replacements = log.replacements;
                }

                if (!options.mergeInto.patchList.length) {
                    options.mergeInto.patchList = log.patchList;
                }

                if (options.mergeInto.userId === null) {
                    options.mergeInto.userId = log.userId;
                }

                if (options.mergeInto.organizationId === null) {
                    options.mergeInto.organizationId = log.organizationId;
                }

                return await options.mergeInto.save();
            }

            try {
                log.validate();
            }
            catch (e) {
                console.error('AuditLog dit not pass validation', log);
            }

            const saved = await log.save();

            // Assign to map
            const d = [...(ModelEventsMap.get(event.model)?.events ?? []), log];

            ModelEventsMap.set(event.model, {
                // Limit length of d to 1 - we only use the first event
                events: d.slice(0, 1),
            });
            return saved;
        }
        catch (e) {
            console.error('Failed to save log', e, log);
        }
        return false;
    };
}
