import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, Field, getOptionalId, IntegerDecoder, isPatchableArray, isPatchMap, MapDecoder, StringDecoder, SymbolDecoder } from '@simonbackx/simple-encoding';
import { AuditLogPatchItem, AuditLogPatchItemType, AuditLogReplacement, AuditLogReplacementType, BooleanStatus, Image, isEmptyFilter, isUuid, PropertyFilter, RichText, Version } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { get } from 'http';

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
                key: getAutoEncoderKey(key),
                oldValue: getAutoEncoderValue(oldValue) || getAutoEncoderName(oldValue) || undefined,
                value: getAutoEncoderValue(value) || getAutoEncoderName(value) || undefined,
            }).autoType(),
        ];
    };
}

function createEnumChangeHandler(key: string) {
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
                key: getAutoEncoderKey(key),
                oldValue: typeof oldValue === 'string' ? AuditLogReplacement.key(oldValue) : undefined,
                value: typeof value === 'string' ? AuditLogReplacement.key(value) : undefined,
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
                key: getAutoEncoderKey(key),
                oldValue: oldValue !== null ? AuditLogReplacement.string(formatter(oldValue)) : undefined,
                value: value !== null ? AuditLogReplacement.string(formatter(value)) : undefined,
            }).autoType(),
        ];
    };
}

function createDateChangeHandler(key: string) {
    return (oldValue: unknown, value: unknown) => {
        if (!(oldValue instanceof Date) && oldValue !== null) {
            return [];
        }

        if ((!(value instanceof Date)) && value !== null) {
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
                key: getAutoEncoderKey(key),
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
                key: getAutoEncoderKey(key),
                oldValue: oldValue === true ? AuditLogReplacement.key('on') : (oldValue === false ? AuditLogReplacement.key('off') : undefined),
                value: value === true ? AuditLogReplacement.key('on') : (value === false ? AuditLogReplacement.key('off') : undefined),
            }).autoType(),
        ];
    };
}

function getAutoEncoderKey(autoEncoder: string): AuditLogReplacement;
function getAutoEncoderKey(autoEncoder: unknown): AuditLogReplacement | null;
function getAutoEncoderKey(autoEncoder: unknown): AuditLogReplacement | null {
    if (typeof autoEncoder === 'string') {
        if (isUuid(autoEncoder)) {
            return AuditLogReplacement.uuid(autoEncoder);
        }
        return AuditLogReplacement.key(autoEncoder);
    }
    return null;
}

function getAutoEncoderName(autoEncoder: unknown): AuditLogReplacement | null {
    if (typeof autoEncoder === 'string') {
        if (isUuid(autoEncoder)) {
            return AuditLogReplacement.uuid(autoEncoder);
        }
        return AuditLogReplacement.string(autoEncoder);
    }

    if (typeof autoEncoder === 'object' && autoEncoder !== null && 'getPatchName' in autoEncoder && typeof autoEncoder.getPatchName === 'function') {
        const name = autoEncoder.getPatchName();
        if (typeof name === 'string') {
            return name ? AuditLogReplacement.string(name) : AuditLogReplacement.key('untitled');
        }
    }

    if (typeof autoEncoder === 'object' && autoEncoder !== null && 'name' in autoEncoder && typeof autoEncoder.name === 'string') {
        return autoEncoder.name ? AuditLogReplacement.string(autoEncoder.name) : AuditLogReplacement.key('untitled');
    }
    return null;
}
function getAutoEncoderPutValue(autoEncoder: unknown): AuditLogReplacement | null {
    if (typeof autoEncoder === 'object' && autoEncoder !== null && 'getPutValue' in autoEncoder && typeof autoEncoder.getPutValue === 'function') {
        const name = autoEncoder.getPutValue();
        if (typeof name === 'string') {
            return AuditLogReplacement.string(name);
        }
        if (name instanceof AuditLogReplacement) {
            return name;
        }
    }
    return getAutoEncoderValue(autoEncoder);
}

function getAutoEncoderValue(autoEncoder: unknown): AuditLogReplacement | null {
    if (typeof autoEncoder === 'string') {
        if (isUuid(autoEncoder)) {
            return AuditLogReplacement.uuid(autoEncoder);
        }
        return AuditLogReplacement.string(autoEncoder);
    }

    if (typeof autoEncoder === 'symbol') {
        const name = Symbol.keyFor(autoEncoder);
        if (name) {
            return AuditLogReplacement.key(name);
        }
        return AuditLogReplacement.key('unknown');
    }

    if (typeof autoEncoder === 'number') {
        return AuditLogReplacement.string(Formatter.integer(autoEncoder));
    }

    if (autoEncoder instanceof Date) {
        return AuditLogReplacement.string(Formatter.dateTime(autoEncoder, true, true));
    }

    if (typeof autoEncoder === 'object' && autoEncoder !== null && 'getPatchValue' in autoEncoder && typeof autoEncoder.getPatchValue === 'function') {
        const name = autoEncoder.getPatchValue();
        if (typeof name === 'string') {
            return AuditLogReplacement.string(name);
        }
        if (name instanceof AuditLogReplacement) {
            return name;
        }
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

    if (autoEncoder instanceof PropertyFilter) {
        if (autoEncoder.isAlwaysEnabledAndRequired) {
            return AuditLogReplacement.key('alwaysEnabledAndRequired');
        }
        if (autoEncoder.enabledWhen === null && autoEncoder.requiredWhen === null) {
            return AuditLogReplacement.key('alwaysEnabledAndOptional');
        }
        if (autoEncoder.enabledWhen !== null && autoEncoder.requiredWhen === null) {
            return AuditLogReplacement.key('sometimesEnabledAndOptional');
        }
        if (autoEncoder.enabledWhen === null && autoEncoder.requiredWhen !== null) {
            return AuditLogReplacement.key('alwaysEnabledAndSometimesRequired');
        }
        if (autoEncoder.enabledWhen !== null && isEmptyFilter(autoEncoder.requiredWhen)) {
            return AuditLogReplacement.key('sometimesEnabledAndRequired');
        }
        return AuditLogReplacement.key('sometimesEnabledAndSometimesRequired');
    }

    return null;
}

function getKeySingular(key: string) {
    return key.replace(/ies$/, 'y').replace(/s$/, '');
}

function findOriginalById(id: unknown, oldArray: unknown[]): unknown | null {
    return id ? oldArray.find(v => getId(v) === id) : null;
}

function getId(object: unknown): string | number | null {
    const id = getOptionalId(object);
    if (typeof id !== 'string' && typeof id !== 'number') {
        if (object instanceof AutoEncoder) {
            const encoded = object.encode({ version: Version });
            return JSON.stringify(encoded);
        }
        return JSON.stringify(object);
    }
    return id;
}

function findOriginal(put: unknown, oldArray: unknown[]): unknown | null {
    return findOriginalById(getId(put), oldArray);
}

function processPut(key: string, put: unknown, original: unknown | null, createdIdSet?: Set<string>): AuditLogPatchItem[] {
    const items: AuditLogPatchItem[] = [];
    const keySingular = getKeySingular(key);
    const v = getAutoEncoderPutValue(put);

    // Added a new parent
    if (!original) {
        items.push(
            AuditLogPatchItem.create({
                key: AuditLogReplacement.key(keySingular).append(getAutoEncoderName(put)),
                value: v || undefined,
                type: AuditLogPatchItemType.Added,
            }),
        );
    }

    // Little hack: detect PUT/DELETE behaviour:
    if (createdIdSet) {
        const id = getId(put);
        if (id && typeof id === 'string') {
            createdIdSet.add(id);
        }
    }

    if (!original && (v || getAutoEncoderName(put))) {
        // Simplify addition: don't show all added properties
        return items;
    }

    items.push(
        ...explainPatch(
            original ?? null,
            put,
        ).map((i) => {
            i.key = i.key.prepend(getAutoEncoderName(original) || getAutoEncoderName(put) || AuditLogReplacement.key('item'));
            i.key = i.key.prepend(getAutoEncoderKey(key));
            return i;
        }),
    );
    return items;
}

function processPatch(key: string, patch: unknown, original: unknown | null): AuditLogPatchItem[] {
    if (!original) {
        // Not supported
        return [];
    }

    if (patch === original) {
        return [];
    }

    const items: AuditLogPatchItem[] = [];
    const keySingular = getKeySingular(key);

    const l = explainPatch(
        original,
        patch,
    ).map((i) => {
        i.key = i.key.prepend(getAutoEncoderName(original) || getAutoEncoderName(patch) || AuditLogReplacement.key('item'));
        i.key = i.key.prepend(getAutoEncoderKey(key));
        return i;
    });
    let ov = getAutoEncoderValue(original);
    let v = getAutoEncoderValue(patch);

    if (l.length === 0 && patch instanceof AutoEncoder && patch.isPatch()) {
        items.push(
            AuditLogPatchItem.create({
                key: getAutoEncoderKey(keySingular).append(getAutoEncoderName(original) || getAutoEncoderName(patch) || AuditLogReplacement.key('item')),
                oldValue: ov || undefined,
                value: v || undefined,
                type: AuditLogPatchItemType.Changed,
            }),
        );
        return items;
    }

    if (ov && v) {
        if (ov.toString() === v.toString()) {
            ov = null;
            v = null;

            if (l.length === 0) {
                // Probably no change
                return [];
            }
        }

        // Simplify changes by providing one change instead of for all keys
        items.push(
            AuditLogPatchItem.create({
                key: getAutoEncoderKey(keySingular).append(getAutoEncoderName(original) || getAutoEncoderName(v) || AuditLogReplacement.key('item')),
                oldValue: ov || undefined,
                value: v || undefined,
                type: AuditLogPatchItemType.Changed,
            }),
        );
        return items;
    }

    items.push(
        ...l,
    );

    return items;
}

function processDelete(key: string, deletedItem: unknown, createdIdSet?: Set<string>): AuditLogPatchItem[] {
    if (createdIdSet) {
        const id = getId(deletedItem);
        if (id && typeof id === 'string' && createdIdSet.has(id)) {
            // DELETE + PUT happened
            return [];
        }
    }

    const v = getAutoEncoderPutValue(deletedItem);

    const keySingular = getKeySingular(key);
    const k = AuditLogReplacement.key(keySingular).append(getAutoEncoderName(deletedItem));

    return [
        AuditLogPatchItem.create({
            key: k,
            type: AuditLogPatchItemType.Removed,
            oldValue: v ?? undefined,
        }),
    ];
}

function createArrayChangeHandler(key: string) {
    return (oldValue: unknown, value: unknown) => {
        if (!Array.isArray(oldValue)) {
            // Not supported
            return [];
        }
        const items: AuditLogPatchItem[] = [];

        if (!isPatchableArray(value)) {
            if (Array.isArray(value)) {
                // Search for puts
                for (const newItem of value) {
                    const original = findOriginal(newItem, oldValue);

                    if (!original) {
                        // Has been added
                        items.push(...processPut(key, newItem, original));
                    }
                    else {
                        // Has been overwritten
                        items.push(...processPatch(key, newItem, original));
                    }
                }

                // Search for deletes
                for (const original of oldValue) {
                    const newItem = findOriginal(original, value);
                    if (!newItem) {
                        // Has been deleted
                        items.push(...processDelete(key, original));
                    }
                }
            }
            // Not supported
            return items;
        }

        const createdIdSet = new Set<string>();

        for (const { put } of value.getPuts()) {
            items.push(...processPut(key, put, findOriginal(put, oldValue), createdIdSet));
        }

        for (const patch of value.getPatches()) {
            items.push(...processPatch(key, patch, findOriginal(patch, oldValue)));
        }

        for (const id of value.getDeletes()) {
            items.push(...processDelete(key, findOriginalById(id, oldValue), createdIdSet));
        }

        if (value.getMoves().length > 0) {
            items.push(
                AuditLogPatchItem.create({
                    key: getAutoEncoderKey(key),
                    type: AuditLogPatchItemType.Reordered,
                }),
            );
        }
        return items;
    };
}

function createMapChangeHandler(key?: string) {
    return (oldValue: unknown, value: unknown) => {
        if (!(value instanceof Map)) {
            // Not supported
            return [];
        }
        if (!(oldValue instanceof Map)) {
            // Not supported
            return [];
        }

        const items: AuditLogPatchItem[] = [];
        const keySingular = key ? key.replace(/ies$/, 'y').replace(/s$/, '') : key;
        const isPatch = isPatchMap(value);

        for (const [k, v] of value.entries()) {
            if (typeof k !== 'string') {
                // Not supported
                continue;
            }
            let original = oldValue.get(k);

            if (v instanceof Map && !original) {
                original = new Map();
            }

            if (v === null && isPatch) {
                // Delete
                if (original) {
                    items.push(
                        AuditLogPatchItem.create({
                            key: AuditLogReplacement.key(keySingular).append(getAutoEncoderKey(k)).append(getAutoEncoderName(original)),
                            oldValue: getAutoEncoderPutValue(original) || undefined,
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
                        key: AuditLogReplacement.key(keySingular).append(getAutoEncoderKey(k)).append(getAutoEncoderName(v)),
                        value: getAutoEncoderPutValue(v) || undefined,
                        type: AuditLogPatchItemType.Added,
                    }),
                );
            }
            else {
                let ov = getAutoEncoderValue(original);
                let nv = getAutoEncoderValue(v);

                const c = explainPatch(
                    original,
                    v,
                ).map((i) => {
                    i.key = i.key.prepend(getAutoEncoderName(original) || getAutoEncoderName(v) || getAutoEncoderKey(k));
                    i.key = i.key.prepend(AuditLogReplacement.key(keySingular));
                    return i;
                });

                if (ov && nv) {
                    if (ov.toString() === nv.toString()) {
                        ov = null;
                        nv = null;

                        if (c.length === 0) {
                            // Probably no change
                            continue;
                        }
                    }

                    // Simplify change
                    items.push(
                        AuditLogPatchItem.create({
                            key: AuditLogReplacement.key(keySingular).append(getAutoEncoderKey(k)).append(getAutoEncoderName(original) || getAutoEncoderName(v)),
                            oldValue: ov || undefined,
                            value: nv || undefined,
                            type: AuditLogPatchItemType.Changed,
                        }),
                    );
                    continue;
                }

                if (c.length === 0 && v instanceof AutoEncoder && v.isPatch()) {
                    // Manual log
                    items.push(
                        AuditLogPatchItem.create({
                            key: AuditLogReplacement.key(keySingular).append(getAutoEncoderKey(k)).append(getAutoEncoderName(original) || getAutoEncoderName(v)),
                            oldValue: getAutoEncoderValue(original) || undefined,
                            value: getAutoEncoderValue(v) || undefined,
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

        if (!isPatch) {
            // Loop old values
            for (const [k, v] of oldValue.entries()) {
                if (typeof k !== 'string') {
                    // Not supported
                    continue;
                }

                if (value.has(k)) {
                    continue;
                }

                items.push(
                    AuditLogPatchItem.create({
                        key: AuditLogReplacement.key(keySingular).append(getAutoEncoderKey(k)).append(getAutoEncoderName(v)),
                        oldValue: getAutoEncoderPutValue(v) || undefined,
                        type: AuditLogPatchItemType.Removed,
                    }),
                );
            }
        }

        return items;
    };
}

function createUnknownChangeHandler(key: string) {
    return (oldValue: unknown, value: unknown) => {
        if (typeof value !== 'object' && value !== null) {
            return [];
        }

        if (oldValue === value) {
            return [];
        }

        if (!oldValue && getAutoEncoderValue(value)) {
        // Simplify addition
            return [
                AuditLogPatchItem.create({
                    key: getAutoEncoderKey(key),
                    value: getAutoEncoderPutValue(value) || undefined,
                    type: AuditLogPatchItemType.Added,
                }),
            ];
        }

        if (oldValue && value === null) {
            return [
                AuditLogPatchItem.create({
                    key: getAutoEncoderKey(key),
                    oldValue: getAutoEncoderPutValue(oldValue) || undefined,
                    type: AuditLogPatchItemType.Removed,
                }),
            ];
        }

        const items = explainPatch(oldValue, value).map((i) => {
            i.key = i.key.prepend(getAutoEncoderKey(key));
            return i;
        });

        let v = getAutoEncoderValue(value);
        let ov = getAutoEncoderValue(oldValue);

        if (oldValue && value && getAutoEncoderValue(value) && items.length === 0 && value instanceof AutoEncoder && value.isPatch()) {
            return [
                AuditLogPatchItem.create({
                    key: getAutoEncoderKey(key),
                    value: v || undefined,
                    oldValue: ov || undefined,
                    type: AuditLogPatchItemType.Changed,
                }),
            ];
        }

        if (v && ov) {
        // Simplify change
            if (v.toString() === ov.toString()) {
                v = null;
                ov = null;

                if (items.length === 0) {
                    // Probably no change
                    return [];
                }
            }

            return [
                AuditLogPatchItem.create({
                    key: getAutoEncoderKey(key),
                    value: v || undefined,
                    oldValue: ov || undefined,
                    type: AuditLogPatchItemType.Changed,
                }),
            ];
        }
        return items;
    };
}

function getExplainerForField(field: Field<any>) {
    if (field.decoder === StringDecoder) {
        return createStringChangeHandler(field.property);
    }

    if (field.decoder instanceof EnumDecoder) {
        return createEnumChangeHandler(field.property);
    }

    if (field.decoder instanceof SymbolDecoder) {
        if (field.decoder.decoder === StringDecoder) {
            return createStringChangeHandler(field.property);
        }

        if (field.decoder.decoder instanceof EnumDecoder) {
            return createEnumChangeHandler(field.property);
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
                    key: getAutoEncoderKey(field.property),
                    oldValue: wasTrueOld === true ? AuditLogReplacement.string('Aangevinkt') : (wasTrueOld === false ? AuditLogReplacement.string('Uitgevinkt') : undefined),
                    value: isTrue === true ? AuditLogReplacement.string('Aangevinkt') : (isTrue === false ? AuditLogReplacement.string('Uitgevinkt') : undefined),
                }),
            ];
        };
    }

    return createUnknownChangeHandler(field.property);
}

export function explainPatch(original: unknown | null, patch: unknown): AuditLogPatchItem[] {
    if (isPatchableArray(patch)) {
        const b = createArrayChangeHandler('items');
        return b(original, patch);
    }

    if (original instanceof Map) {
        const b = createMapChangeHandler();
        return b(original, patch);
    }

    if (typeof patch !== 'object' || patch === null) {
        if (patch === null) {
            // todo
        }
        return [];
    }
    if (original && typeof original !== 'object') {
        return [];
    }

    const items: AuditLogPatchItem[] = [];

    for (const key in patch) {
        const field = original instanceof AutoEncoder
            ? original.static.latestFields.find(f => f.property === key)
            : (
                    patch instanceof AutoEncoder
                        ? patch.static.latestFields.find(f => f.property === key)
                        : null
                );
        const oldValue = original?.[key] ?? null;
        const value = patch[key];

        if (!(patch instanceof AutoEncoder) || !field) {
            // try manual without type information
            items.push(...createUnknownChangeHandler(key)(oldValue, value));
            continue;
        }

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
