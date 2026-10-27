import { SimpleError } from '@simonbackx/simple-errors';

import { Cloneable, cloneObject } from '../classes/Cloneable.js';
import { Data } from '../classes/Data.js';
import { Decoder } from '../classes/Decoder.js';
import { Encodeable, encodeObject, PlainObject } from '../classes/Encodeable.js';
import { EncodeContext } from '../classes/EncodeContext.js';
import { getId, hasId, Identifiable } from '../classes/Identifiable.js';
import { isPatchable, Patchable } from '../classes/Patchable.js';

type PutAfter<Id, Put> = { afterId?: Id | null; put: Put };
type MoveAfter<Id> = { afterId: Id | null; move: Id };
type PatchItem<Patch> = { patch: Patch };
type DeleteItem<Id> = { delete: Id };

type Change<Id, Put, Patch> = PutAfter<Id, Put> | MoveAfter<Id> | DeleteItem<Id> | PatchItem<Patch>;

function isMove(val: Change<any, any, any>): val is MoveAfter<any> {
    return (val as any).move !== undefined;
}

function isPut(val: Change<any, any, any>): val is PutAfter<any, any> {
    return (val as any).put !== undefined;
}

function isDelete(val: Change<any, any, any>): val is DeleteItem<any> {
    return (val as any).delete !== undefined;
}

function isPatch(val: Change<any, any, any>): val is PatchItem<any> {
    return (val as any).patch !== undefined;
}

/**
 * Records ordered insert, move, delete, and patch operations for an array.
 * String/number elements identify themselves; objects are identified by their id.
 * Use unique identifiers so each operation targets an unambiguous item.
 */
export class PatchableArray<
    Id extends string | number,
    Put extends (Identifiable<Id> & Encodeable & Patchable<Patch>) | Id,
    Patch extends (Identifiable<Id> & Encodeable) | Put,
> implements Encodeable, Patchable<PatchableArray<Id, Put, Patch>>, Cloneable {
    _isPatchableArray = true;
    changes: Change<Id, Put, Patch>[];

    constructor(changes?: Change<Id, Put, Patch>[]) {
        this.changes = changes ?? [];
    }

    clone<T extends this>(this: T): this {
        // Deep clone self
        const cloned = new PatchableArray<Id, Put, Patch>() as this;
        cloned.merge(this);
        return cloned;
    }

    merge(other: PatchableArray<Id, Put, Patch>) {
        // We need to clone the incoming changes, because otherwise we would keep the same reference
        // to individual changes we might still change
        for (const change of other.changes) {
            this.changes.push(cloneObject<any>(change));
        }
    }

    /** Composes changes into a clone; a plain array replaces the accumulated patch. */
    patch(patch: PatchableArray<Id, Put, Patch> | Put[]): this {
        if (Array.isArray(patch)) {
            // Transform itself into a normal array. Override all existing patches
            return patch.slice() as any;
        }
        // Deep clone self
        const cloned = this.clone();

        for (const change of patch.changes) {
            // Apply this change
            if (isMove(change)) {
                cloned.addMove(change.move, change.afterId);
            }
            else if (isPut(change)) {
                cloned.addPut(change.put, change.afterId);
            }
            else if (isDelete(change)) {
                cloned.addDelete(change.delete);
            }
            else if (isPatch(change)) {
                cloned.addPatch(change.patch);
            }
            else {
                throw new Error('Invalid change: ' + JSON.stringify(change));
            }
        }

        return cloned;
    }

    /**
     * Records an insertion. An object with an existing id replaces that object
     * when applied (since v2.23.0); scalar values can be inserted more than once.
     * @param value Value to insert in the array
     * @param after
     *      - undefined (or not provided) = insert at the end
     *      - null = insert at the start
     *      - id = insert after the provided id. If the provided id is not found, it is appended at the end
     */
    addPut(value: Put, after?: Id | null) {
        this.changes.push({ afterId: after, put: value });
    }

    /** Moves an item after an id, or to the start for null; an absent target id means the end. */
    addMove(item: Id, after: Id | null) {
        this.changes.push({ afterId: after, move: item });
    }

    hasChanges(item: Id) {
        for (const change of this.changes) {
            if (isMove(change)) {
                // ok
            }
            else if (isPut(change)) {
                if (getId(change.put) === item) {
                    return true;
                }
            }
            else if (isDelete(change)) {
                if (change.delete === item) {
                    return true;
                }
            }
            else if (isPatch(change)) {
                if (getId(change.patch) === item) {
                    return true;
                }
            }
            else {
                throw new Error('Invalid change: ' + JSON.stringify(change));
            }
        }
        return false;
    }

    filter(item: Id): PatchableArray<Id, Put, Patch> {
        const construct = this.constructor as typeof PatchableArray;
        const n: PatchableArray<Id, Put, Patch> = new construct();

        const newCurrentChanges: Change<Id, Put, Patch>[] = [];

        for (const change of this.changes) {
            if (isMove(change)) {
                newCurrentChanges.push(change);
            }
            else if (isPut(change)) {
                if (getId(change.put) === item) {
                    n.changes.push(change);
                }
                else {
                    newCurrentChanges.push(change);
                }
            }
            else if (isDelete(change)) {
                if (change.delete === item) {
                    n.changes.push(change);
                }
                else {
                    newCurrentChanges.push(change);
                }
            }
            else if (isPatch(change)) {
                if (getId(change.patch) === item) {
                    n.changes.push(change);
                }
                else {
                    newCurrentChanges.push(change);
                }
            }
            else {
                throw new Error('Invalid change: ' + JSON.stringify(change));
            }
        }

        this.changes = newCurrentChanges;
        return n;
    }

    /**
     * Records changes to an item identified by the patch's id.
     * Composes with an existing put/patch for that id. Applying to an absent item
     * does nothing and never creates a default object.
     */
    addPatch(value: Patch) {
        const id = getId(value);
        const otherPut = this.changes.findIndex(e => isPut(e) && getId(e.put) == id);
        if (otherPut !== -1) {
            const other: PutAfter<Id, Put> = this.changes[otherPut] as any;

            if (isPatchable(other.put)) {
                this.changes.splice(otherPut, 1, {
                    put: other.put.patch(value as any),
                    afterId: other.afterId,
                });
            }
            else {
                this.changes.splice(otherPut, 1, {
                    put: value as Put,
                    afterId: other.afterId,
                });
            }
            return;
        }

        const otherPatch = this.changes.findIndex(e => isPatch(e) && getId(e.patch) == id);
        if (otherPatch !== -1) {
            const other: PatchItem<Patch> = this.changes[otherPatch] as any;

            if (isPatchable(other.patch)) {
                this.changes.splice(otherPatch, 1, {
                    patch: other.patch.patch(value as any),
                });
            }
            else {
                this.changes.splice(otherPatch, 1, {
                    patch: value,
                });
            }
            return;
        }

        this.changes.push({ patch: value });
    }

    /** Records removal by id; cancels a pending put for that id instead of adding a delete. */
    addDelete(id: Id) {
        // Remove all puts, patches and moves
        const otherPut = this.changes.findIndex(e => isPut(e) && getId(e.put) == id);
        if (otherPut !== -1) {
            // if it had a put, remove the put but don't add a delete
            this.changes.splice(otherPut, 1);
            return;
        }
        else {
            const otherPatch = this.changes.findIndex(e => isPatch(e) && getId(e.patch) == id);
            if (otherPatch !== -1) {
                this.changes.splice(otherPatch, 1);
            }
        }

        this.changes.push({ delete: id });
    }

    /**
     * Applies operations to a copy of the array, leaving the input unchanged.
     * Missing patch IDs are ignored; missing move/delete IDs emit a warning.
     */
    applyTo(array: Put[]): Put[] {
        const newArray = array.slice(0);

        for (const change of this.changes) {
            // Apply this change
            if (isMove(change)) {
                // First do a delete of this value
                const index = newArray.findIndex(e => getId(e) === change.move);

                if (index !== -1) {
                    const value = newArray[index];
                    newArray.splice(index, 1);
                    // Insert it again

                    // null = inserting at the beginning
                    // not found = inserting at the end
                    let afterIndex = -1;
                    if (change.afterId !== null) {
                        afterIndex = newArray.findIndex(e => getId(e) === change.afterId);
                        if (afterIndex === -1) {
                            afterIndex = newArray.length - 1;
                        }
                    }
                    newArray.splice(afterIndex + 1, 0, value);
                }
                else {
                    // maybe throw here?
                    console.warn('Could not find element with id ' + change.move);
                }
            }
            else if (isPut(change)) {
                // null = inserting at the beginning
                // not found = inserting at the end
                let afterIndex = -1;
                if (change.afterId !== null) {
                    afterIndex = newArray.findIndex(e => getId(e) === change.afterId);
                    if (afterIndex === -1) {
                        afterIndex = newArray.length - 1;
                    }
                }
                if (change.afterId === undefined) {
                    afterIndex = newArray.length - 1;
                }
                if (hasId(change.put)) {
                    // Delete any items with the same id first
                    const existingIndex = newArray.findIndex(e => getId(e) === getId(change.put));
                    if (existingIndex !== -1) {
                        newArray.splice(existingIndex, 1);
                        // Adjust afterIndex if needed
                        if (existingIndex < afterIndex) {
                            afterIndex--;
                        }
                    }
                }
                newArray.splice(afterIndex + 1, 0, change.put);
            }
            else if (isDelete(change)) {
                // First do a delete of this value
                const index = newArray.findIndex(e => getId(e) === change.delete);
                if (index !== -1) {
                    newArray.splice(index, 1);
                }
                else {
                    console.warn('Could not find element with id ' + change.delete);
                }
            }
            else if (isPatch(change)) {
                // First do a delete of this value
                const index = newArray.findIndex(e => getId(e) === getId(change.patch));

                if (index !== -1) {
                    // Patch!
                    const value = newArray[index];
                    if (isPatchable(value)) {
                        newArray.splice(index, 1, value.patch(change.patch as any));
                    }
                    else {
                        newArray.splice(index, 1, change.patch as Put);
                    }
                }
            }
            else {
                throw new Error('Invalid change: ' + JSON.stringify(change));
            }
        }

        return newArray;
    }

    encode(context: EncodeContext) {
        return {
            _isPatch: true,
            changes: this.changes.map(
                (change): PlainObject => {
                    if (isMove(change)) {
                        // First do a delete of this value
                        return {
                            afterId: change.afterId,
                            move: encodeObject(change.move, context),
                        };
                    }
                    else if (isPut(change)) {
                        // First do a delete of this value
                        return {
                            afterId: change.afterId,
                            put: encodeObject(change.put, context),
                        };
                    }
                    else if (isDelete(change)) {
                        return {
                            delete: change.delete,
                        };
                    }
                    else if (isPatch(change)) {
                        // First do a delete of this value
                        return {
                            patch: encodeObject(change.patch, context),
                        };
                    }
                },
            ),
        };
    }

    getPuts(): PutAfter<Id, Put>[] {
        return this.changes.filter(change => isPut(change)) as PutAfter<Id, Put>[];
    }

    getPatches(): Patch[] {
        return this.changes.filter(change => isPatch(change)).map((p: PatchItem<Patch>) => p.patch);
    }

    getDeletes(): Id[] {
        return this.changes.filter(change => isDelete(change)).map((p: DeleteItem<Id>) => p.delete);
    }

    getMoves(): MoveAfter<Id>[] {
        return this.changes.filter(change => isMove(change)) as MoveAfter<Id>[];
    }
}

export class PatchableArrayItemDecoder<
    Id extends string | number,
    Put extends (Identifiable<Id> & Encodeable & Patchable<Patch>) | Id,
    Patch extends (Identifiable<Id> & Encodeable) | Put,
> implements Decoder<Change<Id, Put, Patch>> {
    putDecoder: Decoder<Put>;
    patchDecoder: Decoder<Patch>;
    idDecoder: Decoder<Id>;

    constructor(putDecoder: Decoder<Put>, patchDecoder: Decoder<Patch>, idDecoder: Decoder<Id>) {
        this.putDecoder = putDecoder;
        this.patchDecoder = patchDecoder;
        this.idDecoder = idDecoder;
    }

    decode(data: Data): Change<Id, Put, Patch> {
        const put = data.optionalField('put');
        if (put !== undefined) {
            // throw decoding errors from putDecoder and idDecoder
            return {
                put: put.decode(this.putDecoder),
                afterId: data.undefinedField('afterId')?.nullable(this.idDecoder),
            };
        }

        const move = data.optionalField('move');
        if (move !== undefined) {
            return {
                move: move.decode(this.idDecoder),
                afterId: data.field('afterId').nullable(this.idDecoder),
            };
        }

        const d = data.optionalField('delete');
        if (d !== undefined) {
            return {
                delete: d.decode(this.idDecoder),
            };
        }

        const patch = data.optionalField('patch');
        if (patch !== undefined) {
            return {
                patch: patch.decode(this.patchDecoder),
            };
        }

        throw new SimpleError({
            code: 'invalid_field',
            message: 'Expected put, move, patch or delete',
            field: data.currentField,
        });
    }
}

export class PatchableArrayDecoder<
    Id extends string | number,
    Put extends (Identifiable<Id> & Encodeable & Patchable<Patch>) | Id,
    Patch extends (Identifiable<Id> & Encodeable) | Put,
> implements Decoder<PatchableArray<Id, Put, Patch>> {
    putDecoder: Decoder<Put>;
    patchDecoder: Decoder<Patch>;
    idDecoder: Decoder<Id>;

    constructor(putDecoder: Decoder<Put>, patchDecoder: Decoder<Patch>, idDecoder: Decoder<Id>) {
        this.putDecoder = putDecoder;
        this.patchDecoder = patchDecoder;
        this.idDecoder = idDecoder;
    }

    decode(data: Data): PatchableArray<Id, Put, Patch> {
        if (Array.isArray(data.value)) {
            console.warn('Found legacy patchable array. Make sure to use the new patchable array encoding, as this will get removed and replaced with a PUT in future versions.');
            // Legacy encode version
            // This will remain supported for a period
            // but is deprecated
            return new PatchableArray<Id, Put, Patch>(data.array(new PatchableArrayItemDecoder(this.putDecoder, this.patchDecoder, this.idDecoder)));
        }
        const changes = data.field('changes').array(new PatchableArrayItemDecoder(this.putDecoder, this.patchDecoder, this.idDecoder));
        return new PatchableArray<Id, Put, Patch>(changes);
    }

    isDefaultValue(value: unknown): boolean {
        return value instanceof PatchableArray && value.changes.length === 0;
    }

    getDefaultValue(): PatchableArray<Id, Put, Patch> {
        return new PatchableArray();
    }
}
