import { ArrayDecoder, AutoEncoder, EnumDecoder, Field, getOptionalId, isPatchMap, SymbolDecoder } from '@simonbackx/simple-encoding';
import { AuditLogPatchItem, AuditLogPatchItemType, AuditLogReplacement, AuditLogReplacementType, TranslatedString, Version } from '@stamhoofd/structures';
import { DataValidator, Formatter } from '@stamhoofd/utility';

export type PatchExplainer = {
    key: string;
    handler: (oldValue: unknown, value: unknown) => AuditLogPatchItem[];
};

function diffEnum(oldValue: unknown, value: unknown, key?: AuditLogReplacement) {
    if (oldValue === value) {
        return [];
    }

    if (value === undefined) {
        // Not altered
        return [];
    }

    return [
        AuditLogPatchItem.create({
            key,
            oldValue: typeof oldValue === 'string' ? AuditLogReplacement.key(oldValue) : undefined,
            value: typeof value === 'string' ? AuditLogReplacement.key(value) : undefined,
        }).autoType(),
    ];
}

function diffDate(oldValue: unknown, value: unknown, key?: AuditLogReplacement) {
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

    if (dno && dn && (dno === dn || (Formatter.time(oldValue!) !== Formatter.time(value!))) && key?.toKey() !== 'birthDay') {
        // Add time
        dno += ' ' + Formatter.time(oldValue!);
        dn += ' ' + Formatter.time(value!);
    }

    return [
        AuditLogPatchItem.create({
            key,
            oldValue: dno ? AuditLogReplacement.string(dno) : undefined,
            value: dn ? AuditLogReplacement.string(dn) : undefined,
        }).autoType(),
    ];
}

function getDiffKey(autoEncoder: string): AuditLogReplacement;
function getDiffKey(autoEncoder: unknown): AuditLogReplacement | undefined;
function getDiffKey(autoEncoder: unknown): AuditLogReplacement | undefined {
    if (typeof autoEncoder === 'string') {
        if (DataValidator.isUuid(autoEncoder)) {
            return AuditLogReplacement.uuid(autoEncoder);
        }
        return AuditLogReplacement.key(autoEncoder);
    }
    return undefined;
}

/**
 * For arrays or maps, use this name instead of the index/key to identify an object
 */
function getDiffName(autoEncoder: unknown): AuditLogReplacement | null {
    if (typeof autoEncoder === 'string') {
        if (DataValidator.isUuid(autoEncoder)) {
            return AuditLogReplacement.uuid(autoEncoder);
        }
        return AuditLogReplacement.string(autoEncoder);
    }

    if (typeof autoEncoder === 'object' && autoEncoder !== null && 'getDiffName' in autoEncoder && typeof autoEncoder.getDiffName === 'function') {
        const name = autoEncoder.getDiffName();
        if (typeof name === 'string') {
            return name ? AuditLogReplacement.string(name) : AuditLogReplacement.key('untitled');
        }
        if (name instanceof AuditLogReplacement) {
            return name;
        }
        if (name instanceof TranslatedString) {
            return AuditLogReplacement.string(name.toString());
        }
    }

    if (typeof autoEncoder === 'object' && autoEncoder !== null && 'name' in autoEncoder && typeof autoEncoder.name === 'string') {
        return autoEncoder.name ? AuditLogReplacement.string(autoEncoder.name) : AuditLogReplacement.key('untitled');
    }

    if (typeof autoEncoder === 'object' && autoEncoder !== null && 'name' in autoEncoder && autoEncoder.name instanceof TranslatedString) {
        return autoEncoder.name.toString() ? AuditLogReplacement.string(autoEncoder.name.toString()) : AuditLogReplacement.key('untitled');
    }
    return null;
}
function getDiffPutValue(autoEncoder: unknown, key?: AuditLogReplacement): AuditLogReplacement | null {
    if (typeof autoEncoder === 'object' && autoEncoder !== null && 'getDiffPutName' in autoEncoder && typeof autoEncoder.getDiffPutName === 'function') {
        const name = autoEncoder.getDiffPutName();
        if (typeof name === 'string') {
            return AuditLogReplacement.string(name);
        }
        if (name instanceof AuditLogReplacement) {
            return name;
        }
        if (name instanceof TranslatedString) {
            return AuditLogReplacement.string(name.toString());
        }
    }
    return getDiffValue(autoEncoder, key);
}

function getDiffValue(autoEncoder: unknown, key?: AuditLogReplacement): AuditLogReplacement | null {
    if (typeof autoEncoder === 'string') {
        if (DataValidator.isUuid(autoEncoder)) {
            return AuditLogReplacement.uuid(autoEncoder);
        }

        // Is html
        if (autoEncoder.startsWith('<!DOCTYPE html>')) {
            return AuditLogReplacement.html(autoEncoder);
        }

        if (key && key?.lastValue() === 'status') {
            // Will be an enum
            return AuditLogReplacement.key(autoEncoder);
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
        const k = key?.lastValue();
        if (k && (k.toLowerCase().includes('price') || k.toLowerCase().includes('fee'))) {
            return AuditLogReplacement.string(Formatter.price(autoEncoder));
        }
        return AuditLogReplacement.string(Formatter.integer(autoEncoder));
    }

    if (autoEncoder instanceof Date) {
        return AuditLogReplacement.string(Formatter.dateTime(autoEncoder, true, true));
    }

    if (autoEncoder === true) {
        return AuditLogReplacement.key('on');
    }

    if (autoEncoder === false) {
        return AuditLogReplacement.key('off');
    }

    if (typeof autoEncoder === 'object' && autoEncoder !== null && 'getDiffValue' in autoEncoder && typeof autoEncoder.getDiffValue === 'function') {
        const name = autoEncoder.getDiffValue();
        if (typeof name === 'string') {
            return AuditLogReplacement.string(name);
        }
        if (name instanceof AuditLogReplacement) {
            return name;
        }
        if (name instanceof TranslatedString) {
            return AuditLogReplacement.string(name.toString());
        }
    }

    return null;
}

function findOriginalById(id: unknown, oldArray: unknown[]): unknown | null {
    return id ? oldArray.find(v => getId(v) === id) : null;
}

function findOriginalIndexById(id: unknown, oldArray: unknown[]): number {
    return id ? oldArray.findIndex(v => getId(v) === id) : -1;
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

function findIndex(put: unknown, oldArray: unknown[]): number {
    return findOriginalIndexById(getId(put), oldArray);
}

function diffArray(oldValue: unknown, value: unknown, key?: AuditLogReplacement) {
    if (!Array.isArray(oldValue) || !Array.isArray(value)) {
        // Not supported
        return [];
    }
    const items: AuditLogPatchItem[] = [];

    // Search for puts
    let orderChanged = false;
    let added = 0;
    for (const [index, newItem] of value.entries()) {
        const originalIndex = findIndex(newItem, oldValue);

        if (originalIndex === -1) {
            // Has been added
            items.push(...diffUnknown(
                null,
                newItem,
                (getDiffName(newItem) || AuditLogReplacement.key('item')).prepend(key),
            ));
            added++;
        }
        else {
            // Has been overwritten
            const original = oldValue[originalIndex];
            items.push(...diffUnknown(
                original,
                newItem,
                (getDiffName(original) || getDiffName(newItem) || AuditLogReplacement.key('item')).prepend(key),
            ));

            if ((index - added) !== originalIndex) {
                // Order has changed
                orderChanged = true;
            }
        }
    }

    // Search for deletes
    for (const original of oldValue) {
        const newItem = findOriginal(original, value);
        if (!newItem) {
            // Has been deleted
            items.push(...diffUnknown(
                original,
                null,
                (getDiffName(original) || AuditLogReplacement.key('item')).prepend(key),
            ));

            orderChanged = false; // ignore order changed as delete will have set it to true
        }
    }

    if (orderChanged) {
        // Check if order has changed
        items.push(
            AuditLogPatchItem.create({
                key,
                type: AuditLogPatchItemType.Reordered,
            }),
        );
    }
    // Not supported
    return items;
};

function diffMap(oldValue: unknown, value: unknown, key?: AuditLogReplacement) {
    if (!(value instanceof Map)) {
        // Not supported
        return [];
    }
    if (!(oldValue instanceof Map) && oldValue !== undefined && oldValue !== null) {
        // Not supported
        return [];
    }

    const items: AuditLogPatchItem[] = [];
    const isPatch = isPatchMap(value);

    for (const [k, v] of value.entries()) {
        if (typeof k !== 'string') {
            // Not supported
            continue;
        }
        const original = oldValue?.get(k);

        if (v === null && isPatch) {
            // Delete
            if (original) {
                items.push(
                    ...diffUnknown(
                        original,
                        null,
                        (getDiffName(original) || getDiffKey(k)).prepend(key),
                    ),
                );
            }
            continue;
        }

        // Changed
        items.push(
            ...diffUnknown(
                original,
                v,
                (getDiffName(original) || getDiffName(v) || getDiffKey(k)).prepend(key),
            ),
        );
    }

    if (!isPatch && oldValue) {
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
                ...diffUnknown(
                    v,
                    null,
                    (getDiffName(v) || getDiffKey(k)).prepend(key),
                ),
            );
        }
    }

    return items;
}

export function transformValueForDiff(value: unknown) {
    if (typeof value === 'object' && value !== null && 'transformForDiff' in value && typeof value.transformForDiff === 'function') {
        return value.transformForDiff();
    }
    return value;
}

function diffUnknown(oldValue: unknown, value: unknown, key?: AuditLogReplacement) {
    oldValue = transformValueForDiff(oldValue);
    value = transformValueForDiff(value);

    if (oldValue === value) {
        return [];
    }

    if ((oldValue === null || oldValue === undefined) && (value === null || value === undefined)) {
        // Both removed
        return [];
    }

    if (Array.isArray(oldValue) && Array.isArray(value)) {
        return diffArray(oldValue, value, key);
    }

    if (value instanceof Map && (oldValue instanceof Map || oldValue === null || oldValue === undefined)) {
        return diffMap(oldValue, value, key);
    }

    if ((value instanceof Date || value === null) && (oldValue instanceof Date || oldValue === null) && (oldValue !== null || value !== null)) {
        return diffDate(oldValue, value, key);
    }

    if ((oldValue === null || oldValue === undefined) && (value !== null && value !== undefined)) {
        // Simplify addition
        return [
            AuditLogPatchItem.create({
                key,
                value: getDiffPutValue(value, key) || undefined,
                type: AuditLogPatchItemType.Added,
            }),
        ];
    }

    if ((oldValue !== null && oldValue !== undefined) && (value === null || value === undefined)) {
        return [
            AuditLogPatchItem.create({
                key,
                oldValue: getDiffPutValue(oldValue, key) || undefined,
                type: AuditLogPatchItemType.Removed,
            }),
        ];
    }

    const items = diffObject(oldValue, value, key);
    let v = getDiffValue(value, key);
    let ov = getDiffValue(oldValue, key);

    if (oldValue !== undefined && oldValue !== null && value !== undefined && value !== null && getDiffValue(value, key) && items.length === 0 && value instanceof AutoEncoder && value.isPatch()) {
        return [
            AuditLogPatchItem.create({
                key,
                value: v || undefined,
                oldValue: ov || undefined,
                type: AuditLogPatchItemType.Changed,
            }),
        ];
    }

    if (v && ov) {
        // Simplify change
        if (v.toKey() === ov.toKey()) {
            v = null;
            ov = null;

            // if (items.length === 0) {
            // Probably no change
            return [];
            // }
        }

        return [
            AuditLogPatchItem.create({
                key,
                value: v || undefined,
                oldValue: ov || undefined,
                type: AuditLogPatchItemType.Changed,
            }),
        ];
    }
    return items;
};

/**
 * Uses the autoencoder type information to provide a better change handler
 */
function diffField(field: Field<any>, oldValue: unknown, value: unknown, key?: AuditLogReplacement): AuditLogPatchItem[] {
    if (field.decoder instanceof EnumDecoder) {
        return diffEnum(oldValue, value, key);
    }

    if (field.decoder instanceof SymbolDecoder) {
        if (field.decoder.decoder instanceof EnumDecoder) {
            return diffEnum(oldValue, value, key); ;
        }
    }

    if (field.decoder instanceof ArrayDecoder) {
        if (field.decoder.decoder instanceof EnumDecoder) {
            // Map values to keys
            const items = diffArray(oldValue, value, key);

            for (const item of items) {
                if (item.oldValue && !item.oldValue.type) {
                    item.oldValue.type = AuditLogReplacementType.Key;
                }
                if (item.value && !item.value.type) {
                    item.value.type = AuditLogReplacementType.Key;
                }

                // If item.key is an array that ends with a 'value', also change it
                if (item.key.type === AuditLogReplacementType.Array) {
                    const lastKeyItem = item.key.values[item.key.values.length - 1];
                    if (!lastKeyItem.type) {
                        lastKeyItem.type = AuditLogReplacementType.Key;
                    }
                }
                else {
                    if (!item.key.type) {
                        item.key.type = AuditLogReplacementType.Key;
                    }
                }
            }
            return items;
        }

        return diffArray(oldValue, value, key);
    }

    return diffUnknown(oldValue, value, key);
}

function diffObject(original: unknown | null, patch: unknown, rootKey?: AuditLogReplacement): AuditLogPatchItem[] {
    if (typeof patch !== 'object' || patch === null) {
        return [];
    }

    if (original && typeof original !== 'object') {
        return [];
    }

    const items: AuditLogPatchItem[] = [];

    for (const key in patch) {
        if (key === 'id') {
            continue;
        }

        const oldValue = original?.[key] ?? null;
        const value = patch[key];

        if (!(patch instanceof AutoEncoder) && !(oldValue instanceof AutoEncoder)) {
            // try manual without type information
            items.push(...diffUnknown(oldValue, value, getDiffKey(key).prepend(rootKey)));
            continue;
        }

        const field = original instanceof AutoEncoder
            ? original.static.latestFields.find(f => f.property === key)
            : (
                    patch instanceof AutoEncoder
                        ? patch.static.latestFields.find(f => f.property === key)
                        : null
                );

        if (!field) {
            // Ignore: probably an internal field
            continue;
        }

        items.push(...diffField(field, oldValue, value, getDiffKey(key).prepend(rootKey)));
    }
    return items;
}

export class ObjectDiffer {
    static diff(oldValue: unknown, value: unknown, key?: AuditLogReplacement): AuditLogPatchItem[] {
        return diffUnknown(oldValue, value, key);
    }
}
