import { ArrayDecoder, AutoEncoder, AutoEncoderPatchType, BooleanDecoder, DateDecoder, EnumDecoder, Field, IntegerDecoder, isPatchable, isPatchableArray, isPatchMap, MapDecoder, StringDecoder, SymbolDecoder } from '@simonbackx/simple-encoding';
import { Address, AuditLogPatchItem, AuditLogPatchItemType, AuditLogReplacement, AuditLogReplacementType, BooleanStatus, Image, Parent, ParentTypeHelper, RichText } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

export type PatchExplainer = {
    key: string;
    handler: (oldValue: unknown, value: unknown) => AuditLogPatchItem[];
};

function createStringChangeHandler(key: string) {
    return (oldValue: unknown, value: unknown) => {
        if (oldValue === value) {
            return [];
        }

        if (value === undefined) {
            // Not altered
            return [];
        }

        return [
            AuditLogPatchItem.create({
                key: AuditLogReplacement.key(key),
                oldValue: typeof oldValue === 'string' ? AuditLogReplacement.string(oldValue) : undefined,
                value: typeof value === 'string' ? AuditLogReplacement.string(value) : undefined,
            }).autoType(),
        ];
    };
}

function createIntegerChangeHandler(key: string) {
    return (oldValue: unknown, value: unknown) => {
        if ((typeof oldValue !== 'number' && oldValue !== null) || (typeof value !== 'number' && value !== null)) {
            return [];
        }
        if (oldValue === value) {
            return [];
        }

        const formatter: (typeof Formatter.price | typeof Formatter.integer) = key.toLowerCase().includes('price') ? Formatter.price.bind(Formatter) : Formatter.integer.bind(Formatter);
        return [
            AuditLogPatchItem.create({
                key: AuditLogReplacement.key(key),
                oldValue: oldValue !== null ? AuditLogReplacement.string(formatter(oldValue)) : undefined,
                value: value !== null ? AuditLogReplacement.string(formatter(value)) : undefined,
            }).autoType(),
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
        let dno = oldValue ? Formatter.dateNumber(oldValue, true) : undefined;
        let dn = value ? Formatter.dateNumber(value, true) : undefined;

        if (dno && dn && (dno === dn || (Formatter.time(oldValue!) !== Formatter.time(value!)))) {
            // Add time
            dno += ' ' + Formatter.time(oldValue!);
            dn += ' ' + Formatter.time(value!);
        }

        return [
            AuditLogPatchItem.create({
                key: AuditLogReplacement.key(key),
                oldValue: dno ? AuditLogReplacement.string(dno) : undefined,
                value: dn ? AuditLogReplacement.string(dn) : undefined,
            }).autoType(),
        ];
    };
}

function createBooleanChangeHandler(key: string) {
    return (oldValue: unknown, value: unknown) => {
        if (typeof oldValue !== 'boolean' && oldValue !== null) {
            return [];
        }

        if (typeof value !== 'boolean' && value !== null) {
            return [];
        }

        if (oldValue === value) {
            return [];
        }

        return [
            AuditLogPatchItem.create({
                key: AuditLogReplacement.key(key),
                oldValue: oldValue === true ? AuditLogReplacement.string('Aan') : (oldValue === false ? AuditLogReplacement.string('Uit') : undefined),
                value: value === true ? AuditLogReplacement.string('Aan') : (value === false ? AuditLogReplacement.string('Uit') : undefined),
            }).autoType(),
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

    if (typeof autoEncoder === 'object' && autoEncoder !== null && 'name' in autoEncoder && typeof autoEncoder.name === 'string') {
        return autoEncoder.name;
    }
    return null;
}

function getAutoEncoderValue(autoEncoder: unknown): AuditLogReplacement | null {
    if (typeof autoEncoder === 'string') {
        return AuditLogReplacement.string(autoEncoder);
    }

    if (autoEncoder instanceof Parent) {
        return AuditLogReplacement.string(autoEncoder.name + ` (${ParentTypeHelper.getName(autoEncoder.type)})`);
    }

    if (autoEncoder instanceof Address) {
        return AuditLogReplacement.string(autoEncoder.shortString());
    }

    if (typeof autoEncoder === 'object' && autoEncoder !== null && 'name' in autoEncoder && typeof autoEncoder.name === 'string') {
        return AuditLogReplacement.string(autoEncoder.name);
    }

    if (autoEncoder instanceof Image) {
        return AuditLogReplacement.create({
            id: autoEncoder.getPathForSize(undefined, undefined),
            value: autoEncoder.source.name ?? undefined,
            type: AuditLogReplacementType.Image,
        });
    }

    if (autoEncoder instanceof RichText) {
        return AuditLogReplacement.string(autoEncoder.text);
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

        const keySingular = key.replace(/ies$/, 'y').replace(/s$/, '');

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
                        key: AuditLogReplacement.key(keySingular),
                        value: getAutoEncoderValue(put) || AuditLogReplacement.string(keySingular),
                        type: AuditLogPatchItemType.Added,
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
                    const name = getAutoEncoderName(put);
                    if (name) {
                        i.key = i.key.prepend(AuditLogReplacement.string(name));
                    }
                    i.key = i.key.prepend(AuditLogReplacement.key(key));
                    return i;
                }),
            );
        }

        for (const patch of value.getPatches()) {
            const original = oldValue.find(v => v.id === patch.id);
            if (!original) {
                // Not supported
                continue;
            }
            if (!(original instanceof AutoEncoder)) {
                // Not supported
                continue;
            }

            const l = explainPatch(
                original,
                patch,
            ).map((i) => {
                const name = getAutoEncoderName(original);
                if (name) {
                    i.key = i.key.prepend(AuditLogReplacement.string(name));
                }
                i.key = i.key.prepend(AuditLogReplacement.key(key));
                return i;
            });

            if (l.length === 0) {
                items.push(
                    AuditLogPatchItem.create({
                        key: AuditLogReplacement.key(keySingular),
                        value: getAutoEncoderValue(original) || undefined,
                        type: AuditLogPatchItemType.Changed,
                    }),
                );
            }

            items.push(
                ...l,
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

            let k = AuditLogReplacement.key(keySingular);

            const name = getAutoEncoderName(original);
            if (name) {
                k = k.prepend(AuditLogReplacement.string(name));
            }

            items.push(
                AuditLogPatchItem.create({
                    key: k,
                    type: AuditLogPatchItemType.Removed,
                }),
            );
        }

        if (value.getMoves().length > 0) {
            items.push(
                AuditLogPatchItem.create({
                    key: AuditLogReplacement.key(key),
                    type: AuditLogPatchItemType.Reordered,
                }),
            );
        }
        return items;
    };
}

function createMapChangeHandler(key: string) {
    return (oldValue: unknown, value: unknown) => {
        if (!isPatchMap(value)) {
            // Not supported
            return [];
        }
        if (!(oldValue instanceof Map)) {
            // Not supported
            return [];
        }

        const items: AuditLogPatchItem[] = [];
        const keySingular = key.replace(/ies$/, 'y').replace(/s$/, '');

        for (const [k, v] of value.entries()) {
            if (typeof k !== 'string') {
                // Not supported
                continue;
            }
            const original = oldValue.get(k);

            if (v === null) {
                // Delete
                if (original) {
                    items.push(
                        AuditLogPatchItem.create({
                            key: AuditLogReplacement.key(keySingular),
                            oldValue: getAutoEncoderValue(original as AutoEncoder) || AuditLogReplacement.key(k),
                            type: AuditLogPatchItemType.Removed,
                        }),
                    );
                }
                continue;
            }

            if (!original) {
                // added
                items.push(
                    AuditLogPatchItem.create({
                        key: AuditLogReplacement.key(keySingular),
                        value: getAutoEncoderValue(v as AutoEncoder) || AuditLogReplacement.key(k),
                        type: AuditLogPatchItemType.Added,
                    }),
                );
            }
            else {
                const c = explainPatch(
                    original,
                    v as AutoEncoder,
                ).map((i) => {
                    const name = getAutoEncoderValue(original as AutoEncoder);
                    if (name) {
                        i.key = i.key.prepend(name);
                    }
                    i.key = i.key.prepend(AuditLogReplacement.key(keySingular));
                    return i;
                });

                if (c.length === 0) {
                    // Manual log
                    items.push(
                        AuditLogPatchItem.create({
                            key: AuditLogReplacement.key(keySingular).append(getAutoEncoderValue(original as AutoEncoder) || AuditLogReplacement.key(k)),
                            type: AuditLogPatchItemType.Changed,
                        }),
                    );
                }

                // Changed
                items.push(
                    ...c,
                );
            }
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
        const keySingular = key.replace(/ies$/, 'y').replace(/s$/, '');

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
                    key: AuditLogReplacement.key(keySingular),
                    oldValue: oldValue.length ? AuditLogReplacement.string(oldValueStr) : undefined,
                    value: value.length ? AuditLogReplacement.string(valueStr) : undefined,
                }).autoType(),
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
                        key: AuditLogReplacement.key(keySingular),
                        value: AuditLogReplacement.string(put),
                        type: AuditLogPatchItemType.Added,
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
                    key: AuditLogReplacement.key(keySingular),
                    oldValue: AuditLogReplacement.string(original),
                    type: AuditLogPatchItemType.Removed,
                }),
            );
        }

        if (value.getMoves().length > 0) {
            items.push(
                AuditLogPatchItem.create({
                    key: AuditLogReplacement.key(key),
                    type: AuditLogPatchItemType.Reordered,
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

    if (field.decoder instanceof SymbolDecoder) {
        if (field.decoder.decoder === StringDecoder || field.decoder.decoder instanceof EnumDecoder) {
            return createStringChangeHandler(field.property);
        }
    }

    if (field.decoder === DateDecoder) {
        return createDateChangeHandler(field.property);
    }

    if (field.decoder === BooleanDecoder) {
        return createBooleanChangeHandler(field.property);
    }

    if (field.decoder === IntegerDecoder) {
        return createIntegerChangeHandler(field.property);
    }

    if (field.decoder instanceof ArrayDecoder && field.decoder.decoder === StringDecoder) {
        return createSimpleArrayChangeHandler(field.property);
    }

    if (field.decoder instanceof ArrayDecoder) {
        return createArrayChangeHandler(field.property);
    }

    if (field.decoder instanceof MapDecoder) {
        return createMapChangeHandler(field.property);
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
                    key: AuditLogReplacement.key(field.property),
                    oldValue: wasTrueOld === true ? AuditLogReplacement.string('Aangevinkt') : (wasTrueOld === false ? AuditLogReplacement.string('Uitgevinkt') : undefined),
                    value: isTrue === true ? AuditLogReplacement.string('Aangevinkt') : (isTrue === false ? AuditLogReplacement.string('Uitgevinkt') : undefined),
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

            if (oldValue && value && getAutoEncoderValue(value as AutoEncoder)) {
                // Simplify addition
                return [
                    AuditLogPatchItem.create({
                        key: AuditLogReplacement.key(field.property),
                        value: getAutoEncoderValue(value as AutoEncoder) || AuditLogReplacement.key(field.property),
                        oldValue: getAutoEncoderValue(oldValue as AutoEncoder) || AuditLogReplacement.key(field.property),
                        type: AuditLogPatchItemType.Changed,
                    }),
                ];
            }

            if (!oldValue && getAutoEncoderValue(value as AutoEncoder)) {
                // Simplify addition
                return [
                    AuditLogPatchItem.create({
                        key: AuditLogReplacement.key(field.property),
                        value: getAutoEncoderValue(value as AutoEncoder) || AuditLogReplacement.key(field.property),
                        type: AuditLogPatchItemType.Added,
                    }),
                ];
            }

            if (value === null) {
                return [
                    AuditLogPatchItem.create({
                        key: AuditLogReplacement.key(field.property),
                        oldValue: getAutoEncoderValue(oldValue as AutoEncoder) || AuditLogReplacement.key(field.property),
                        type: AuditLogPatchItemType.Removed,
                    }),
                ];
            }

            return explainPatch(oldValue as AutoEncoder | null, value).map((i) => {
                i.key = i.key.prepend(AuditLogReplacement.key(field.property));
                return i;
            });
        };
    }

    // Simple addition/delete/change detection
    return (oldValue: unknown, value: unknown) => {
        if (value === undefined) {
            return [];
        }

        if (oldValue === value) {
            return [];
        }

        return [
            AuditLogPatchItem.create({
                key: AuditLogReplacement.key(field.property),
                type: AuditLogPatchItemType.Changed,
            }),
        ];
    };
}

export function explainPatch<T extends AutoEncoder>(original: T | null, patch: AutoEncoderPatchType<T> | T): AuditLogPatchItem[] {
    if (isPatchableArray(patch)) {
        const b = createArrayChangeHandler('items');
        return b(original, patch);
    }
    if (!(patch instanceof AutoEncoder)) {
        return [];
    }
    if (original && !(original instanceof AutoEncoder)) {
        return [];
    }

    const items: AuditLogPatchItem[] = [];

    for (const key in patch) {
        const field = original ? original.static.fields.find(f => f.property === key) : patch.static.fields.find(f => f.property === key);
        if (!field) {
            continue;
        }

        const oldValue = original?.[key] ?? null;
        const value = patch[key];

        if (patch.isPut() && key === 'id') {
            continue;
        }

        const handler = getExplainerForField(field);
        if (!handler) {
            continue;
        }

        items.push(...handler(oldValue, value));
    }
    return items;
}
