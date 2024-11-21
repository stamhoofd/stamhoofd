import { ArrayDecoder, AutoEncoder, AutoEncoderPatchType, DateDecoder, EnumDecoder, Field, isPatchableArray, StringDecoder } from '@simonbackx/simple-encoding';
import { AuditLog, Group, Member, Registration } from '@stamhoofd/models';
import { Address, AuditLogPatchItem, AuditLogReplacement, AuditLogReplacementType, AuditLogType, BooleanStatus, MemberDetails, Parent, ParentTypeHelper } from '@stamhoofd/structures';
import { Context } from '../helpers/Context';
import { Formatter } from '@stamhoofd/utility';

export type MemberAddedAuditOptions = {
    type: AuditLogType.MemberAdded;
    member: Member;
};

export type MemberEditedAuditOptions = {
    type: AuditLogType.MemberEdited;
    member: Member;
    oldMemberDetails: MemberDetails;
    memberDetailsPatch: AutoEncoderPatchType<MemberDetails>;
};

export type MemberRegisteredAuditOptions = {
    type: AuditLogType.MemberRegistered | AuditLogType.MemberUnregistered;
    member: Member;
    group: Group;
    registration: Registration;
};

export type AuditLogOptions = MemberAddedAuditOptions | MemberEditedAuditOptions | MemberRegisteredAuditOptions;

export const AuditLogService = {
    async log(options: AuditLogOptions) {
        const userId = Context.optionalAuth?.user?.id ?? null;
        const organizationId = Context.organization?.id ?? null;

        const model = new AuditLog();
        model.type = options.type;
        model.userId = userId;
        model.organizationId = organizationId;

        if (options.type === AuditLogType.MemberRegistered) {
            this.fillForMemberRegistered(model, options);
        }
        else if (options.type === AuditLogType.MemberUnregistered) {
            this.fillForMemberRegistered(model, options);
        }
        else if (options.type === AuditLogType.MemberEdited) {
            this.fillForMemberEdited(model, options);
        }
        else if (options.type === AuditLogType.MemberAdded) {
            this.fillForMemberAdded(model, options);
        }

        // In the future we might group these saves together in one query to improve performance
        await model.save();
    },

    fillForMemberRegistered(model: AuditLog, options: MemberRegisteredAuditOptions) {
        model.objectId = options.member.id;
        model.replacements = new Map([
            ['m', AuditLogReplacement.create({
                id: options.member.id,
                value: options.member.details.name,
                type: AuditLogReplacementType.Member,
            })],
            ['g', AuditLogReplacement.create({
                id: options.group.id,
                value: options.group.settings.name,
                type: AuditLogReplacementType.Group,
            })],
        ]);

        const registrationStructure = options.registration.setRelation(Registration.group, options.group).getStructure();
        if (registrationStructure.description) {
            model.description = registrationStructure.description;
        }
    },

    fillForMemberEdited(model: AuditLog, options: MemberEditedAuditOptions) {
        model.objectId = options.member.id;

        model.replacements = new Map([
            ['m', AuditLogReplacement.create({
                id: options.member.id,
                value: options.member.details.name,
                type: AuditLogReplacementType.Member,
            })],
        ]);

        // Generate changes list
        model.patchList = explainPatch(options.oldMemberDetails, options.memberDetailsPatch);
    },

    fillForMemberAdded(model: AuditLog, options: MemberAddedAuditOptions) {
        model.objectId = options.member.id;

        model.replacements = new Map([
            ['m', AuditLogReplacement.create({
                id: options.member.id,
                value: options.member.details.name,
                type: AuditLogReplacementType.Member,
            })],
        ]);

        // Generate changes list
        model.patchList = explainPatch(null, options.member.details);
    },
};

export type PatchExplainer = {
    key: string;
    handler: (oldValue: unknown, value: unknown) => AuditLogPatchItem[];
};

function createStringChangeHandler(key: string) {
    return (oldValue: unknown, value: unknown) => {
        if ((typeof oldValue !== 'string' && oldValue !== null) || (typeof value !== 'string' && value !== null)) {
            return [];
        }
        if (oldValue === value) {
            return [];
        }
        return [
            AuditLogPatchItem.create({
                key: key,
                oldValue: oldValue ?? undefined,
                value: value ?? undefined,
            }),
        ];
    };
}

function createDateChangeHandler(key: string) {
    return (oldValue: unknown, value: unknown) => {
        if ((!(oldValue instanceof Date) && oldValue !== null) || (!(value instanceof Date)) && value !== null) {
            return [];
        }

        if (oldValue?.getTime() === value?.getTime()) {
            return [];
        }
        return [
            AuditLogPatchItem.create({
                key: key,
                oldValue: oldValue ? Formatter.dateNumber(oldValue, true) : undefined,
                value: value ? Formatter.dateNumber(value, true) : undefined,
            }),
        ];
    };
}

function getAutoEncoderName(autoEncoder: unknown) {
    if (typeof autoEncoder === 'string') {
        return autoEncoder;
    }

    if (autoEncoder instanceof Parent) {
        return autoEncoder.name + ` (${ParentTypeHelper.getName(autoEncoder.type)})`;
    }

    if (autoEncoder instanceof Address) {
        return autoEncoder.shortString();
    }
    return null;
}

function createArrayChangeHandler(key: string) {
    return (oldValue: unknown, value: unknown) => {
        if (!isPatchableArray(value)) {
            // Not supported
            return [];
        }
        if (!Array.isArray(oldValue)) {
            // Not supported
            return [];
        }

        const items: AuditLogPatchItem[] = [];
        const createdIdSet = new Set<string>();

        for (const { put } of value.getPuts()) {
            if (!(put instanceof AutoEncoder)) {
                // Not supported
                continue;
            }

            // Little hack: detect PUT/DELETE behaviour:
            let original = 'id' in put ? oldValue.find(v => v.id === put.id) : null;
            if (original && !(original instanceof AutoEncoder)) {
                // Not supported
                original = null;
            }

            // Added a new parent
            if (!original) {
                items.push(
                    AuditLogPatchItem.create({
                        key,
                        value: getAutoEncoderName(put) || key,
                    }),
                );
            }

            if ('id' in put && typeof put.id === 'string') {
                createdIdSet.add(put.id);
            }

            items.push(
                ...explainPatch(
                    original ?? null,
                    put,
                ).map((i) => {
                    i.name = getAutoEncoderName(put) || key;
                    return i;
                }),
            );
        }

        for (const { patch } of value.getPatches()) {
            const original = oldValue.find(v => v.id === patch.id);
            if (!original) {
                // Not supported
                continue;
            }
            if (!(original instanceof AutoEncoder)) {
                // Not supported
                continue;
            }

            items.push(
                ...explainPatch(
                    original,
                    patch,
                ).map((i) => {
                    i.name = getAutoEncoderName(original) || key;
                    return i;
                }),
            );
        }

        for (const id of value.getDeletes()) {
            if (typeof id !== 'string') {
                continue;
            }
            const original = oldValue.find(v => v.id === id);
            if (!original) {
                // Not supported
                continue;
            }
            if (!(original instanceof AutoEncoder)) {
                // Not supported
                continue;
            }

            if (createdIdSet.has(id)) {
                // DELETE + PUT happened
                continue;
            }

            items.push(
                AuditLogPatchItem.create({
                    key,
                    value: undefined,
                    oldValue: getAutoEncoderName(original) || key,
                }),
            );
        }
        return items;
    };
}

function createSimpleArrayChangeHandler(key: string) {
    return (oldValue: unknown, value: unknown) => {
        if (!Array.isArray(oldValue)) {
            // Not supported
            return [];
        }

        if (Array.isArray(value)) {
            if (!value.every(v => typeof v === 'string')) {
                // Not supported
                return [];
            }
            if (!oldValue.every(v => typeof v === 'string')) {
                // Not supported
                return [];
            }

            // Simple change
            const valueStr = (value as string[]).join(', ');
            const oldValueStr = (oldValue as string[]).join(', ');

            if (valueStr === oldValueStr) {
                return [];
            }

            return [
                AuditLogPatchItem.create({
                    key,
                    oldValue: oldValue.length ? oldValueStr : undefined,
                    value: value.length ? valueStr : undefined,
                }),
            ];
        }

        if (!isPatchableArray(value)) {
            // Not supported
            return [];
        }

        const items: AuditLogPatchItem[] = [];
        const createdIdSet = new Set<string>();

        for (const { put } of value.getPuts()) {
            if (typeof put !== 'string') {
                // Not supported
                continue;
            }

            // Little hack: detect PUT/DELETE behaviour:
            const original = oldValue.find(v => v === put);

            // Added a new parent
            if (!original) {
                items.push(
                    AuditLogPatchItem.create({
                        key,
                        value: put,
                    }),
                );
            }
            createdIdSet.add(put);
        }

        for (const id of value.getDeletes()) {
            if (typeof id !== 'string') {
                continue;
            }

            if (createdIdSet.has(id)) {
                // DELETE + PUT happened
                continue;
            }

            const original = oldValue.find(v => v === id);
            if (!original || typeof original !== 'string') {
                // Not supported
                continue;
            }

            items.push(
                AuditLogPatchItem.create({
                    key,
                    value: undefined,
                    oldValue: original,
                }),
            );
        }
        return items;
    };
}

function getExplainerForField(field: Field<any>) {
    if (field.decoder === StringDecoder || field.decoder instanceof EnumDecoder) {
        return createStringChangeHandler(field.property);
    }

    if (field.decoder === DateDecoder) {
        return createDateChangeHandler(field.property);
    }

    if (field.decoder instanceof ArrayDecoder && field.decoder.decoder === StringDecoder) {
        return createSimpleArrayChangeHandler(field.property);
    }

    if (field.decoder instanceof ArrayDecoder) {
        return createArrayChangeHandler(field.property);
    }

    if (field.decoder === BooleanStatus) {
        return (oldValue: unknown, value: unknown) => {
            if (value === undefined) {
                return [];
            }

            const wasTrueOld = oldValue instanceof BooleanStatus ? oldValue.value : null;
            const isTrue = value instanceof BooleanStatus ? value.value : null;

            if (wasTrueOld === isTrue) {
                return [];
            }

            return [
                AuditLogPatchItem.create({
                    key: field.property,
                    oldValue: wasTrueOld === true ? 'Aangevinkt' : (wasTrueOld === false ? 'Uitgevinkt' : undefined),
                    value: isTrue === true ? 'Aangevinkt' : (isTrue === false ? 'Uitgevinkt' : undefined),
                }),
            ];
        };
    }

    if ((field.decoder as any).prototype instanceof AutoEncoder || field.decoder === AutoEncoder) {
        return (oldValue: unknown, value: unknown) => {
            if (!(value instanceof AutoEncoder) && value !== null) {
                return [];
            }

            if (oldValue === value) {
                return [];
            }

            if (!oldValue && getAutoEncoderName(value as AutoEncoder)) {
                // Simplify addition
                return [
                    AuditLogPatchItem.create({
                        key: field.property,
                        value: getAutoEncoderName(value as AutoEncoder) || field.property,
                    }),
                ];
            }

            if (value === null) {
                return [
                    AuditLogPatchItem.create({
                        key: field.property,
                        oldValue: getAutoEncoderName(oldValue as AutoEncoder) || field.property,
                    }),
                ];
            }

            return explainPatch(oldValue as AutoEncoder | null, value).map((i) => {
                i.key = field.property + '.' + i.key;
                return i;
            });
        };
    }
}

function explainPatch<T extends AutoEncoder>(original: T | null, patch: AutoEncoderPatchType<T> | T): AuditLogPatchItem[] {
    const items: AuditLogPatchItem[] = [];

    for (const key in patch) {
        const field = original ? original.static.fields.find(f => f.property === key) : patch.static.fields.find(f => f.property === key);
        if (!field) {
            continue;
        }

        const oldValue = original?.[key] ?? null;
        const value = patch[key];

        const handler = getExplainerForField(field);
        if (!handler) {
            continue;
        }

        items.push(...handler(oldValue, value));
    }
    return items;
}
