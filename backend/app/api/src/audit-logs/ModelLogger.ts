import { Model, ModelEvent } from '@simonbackx/simple-database';
import { Context } from '../helpers/Context';
import { createUnknownChangeHandler } from '../services/explainPatch';
import { AuditLog } from '@stamhoofd/models';
import { AuditLogType, AuditLogReplacement } from '@stamhoofd/structures';

export type ModelEventLogOptions<D> = {
    type: AuditLogType;
    generatePatchList?: boolean;
    data: D;
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
    generateDescription?(event: ModelEvent<M>, options: ModelEventLogOptions<D>): string | null | undefined;
    createReplacements?(model: M, options: ModelEventLogOptions<D>): Map<string, AuditLogReplacement>;
    postProcess?(event: ModelEvent<M>, options: ModelEventLogOptions<D>, log: AuditLog): Promise<void> | void;
};

export function getDefaultGenerator(types: DefaultLogOptionsType): EventOptionsGenerator<any, undefined> {
    return (event: ModelEvent<any>) => {
        if (event.type === 'created') {
            if (types.created) {
                return { type: types.created, data: undefined };
            }
            return;
        }

        if (event.type === 'updated') {
            // Generate changes list
            if ('deletedAt' in event.changedFields && event.model.deletedAt) {
                if (!('deletedAt' in event.originalFields) || !event.originalFields.deletedAt) {
                    event = {
                        ...event,
                        type: 'deleted',
                    };

                    if (types.deleted) {
                        return { type: types.deleted, data: undefined };
                    }
                }
            }

            if (types.updated) {
                if ('createdAt' in event.model && event.model.createdAt instanceof Date && event.model.createdAt.getTime() >= Date.now() - 1000) {
                    // Ignore quick model changes after insertion: these are often side effects of code that should not be logged
                    // (the created event normally doesn't contain what has been added - so no need to log what has been changed since creation)
                    if (types.created && types.created !== types.updated) {
                        console.log('Ignoring quick model changes after insertion');
                        return;
                    }
                }

                return { type: types.updated, generatePatchList: true, data: undefined };
            }
            return;
        }

        if (event.type === 'deleted') {
            if (types.deleted) {
                return { type: types.deleted, data: undefined };
            }
            return;
        }
    };
}

export class ModelLogger<ModelType extends typeof Model, M extends InstanceType<ModelType>, D> {
    model: ModelType;
    optionsGenerator: EventOptionsGenerator<M, D>;
    skipKeys: string[] = [];
    generateDescription?: (event: ModelEvent<M>, options: ModelEventLogOptions<D>) => string | null | undefined;
    createReplacements?: (model: M, options: ModelEventLogOptions<D>) => Map<string, AuditLogReplacement>;
    postProcess?: (event: ModelEvent<M>, options: ModelEventLogOptions<D>, log: AuditLog) => Promise<void> | void;
    static sharedSkipKeys = ['id', 'createdAt', 'updatedAt', 'deletedAt'];

    constructor(model: ModelType, options: ModelLoggerOptions<M, D>) {
        this.model = model;
        this.optionsGenerator = options.optionsGenerator;
        this.skipKeys = options.skipKeys ?? [];
        this.generateDescription = options.generateDescription;
        this.createReplacements = options.createReplacements;
        this.postProcess = options.postProcess;
    }

    async logEvent(event: ModelEvent<M>) {
        try {
            const userId = Context.optionalAuth?.user?.id ?? null;
            const organizationId = Context.organization?.id ?? null;

            const log = new AuditLog();

            log.userId = userId;
            log.organizationId = organizationId;

            const options = await this.optionsGenerator(event);

            if (!options) {
                return false;
            }

            log.type = options.type;
            log.objectId = event.model.getPrimaryKey()?.toString() ?? null;
            log.replacements = this.createReplacements ? this.createReplacements(event.model as M, options) : new Map();
            log.description = (this.generateDescription ? this.generateDescription(event, options) : '') ?? '';

            if (options.generatePatchList && event.type === 'updated') {
                const oldModel = event.getOldModel();

                // Generate changes list
                const changedProperties = Object.keys(event.changedFields).filter(k => !this.skipKeys?.includes(k) && !ModelLogger.sharedSkipKeys.includes(k));

                if (changedProperties.length > 0) {
                    for (const key of changedProperties) {
                        log.patchList.push(...createUnknownChangeHandler(key)(
                            key in oldModel ? oldModel[key] : undefined,
                            key in event.model ? event.model[key] : undefined,
                        ));
                    }

                    // Remove skipped keys
                    log.patchList = log.patchList.filter(p => !this.skipKeys?.includes(p.key.toKey()));

                    if (log.patchList.length === 0 && !log.description) {
                        // No changes or all skipped
                        console.log('No changes after secundary filtering');
                        return false;
                    }
                }
                else {
                    console.log('No changes');
                    return false;
                }
            }

            if (this.postProcess) {
                await this.postProcess(event, options, log);
            }

            return await log.save();
        }
        catch (e) {
            console.error('Failed to save log', e);
        }
        return false;
    };
}
