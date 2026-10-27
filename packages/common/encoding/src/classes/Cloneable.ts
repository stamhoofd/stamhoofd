export interface Cloneable {
    clone<T extends this>(this: T): this;
}

export function isCloneable(object: any): object is Cloneable {
    if (typeof object !== 'object' || object === null) {
        return false;
    }
    return typeof object.clone === 'function';
}

export type CloneableObject = Cloneable | CloneableObject[] | Map<CloneableObject, CloneableObject> | string | number | { [key: string]: CloneableObject } | boolean | undefined | null | Date;

/**
 * Clones supported containers recursively and delegates to Cloneable implementations.
 * Other objects are shallow-copied with their actual prototype and own enumerable properties.
 */
export function cloneObject<T extends CloneableObject>(obj: T): T {
    if (isCloneable(obj)) {
        return (obj).clone(); // paranthesis fix type checking for some reason?
    }

    if (Array.isArray(obj)) {
        return (obj).map((e) => {
            return cloneObject(e);
        }) as (T & any[]);
    }

    if (obj instanceof Map) {
        // Transform into a normal object to conform to MapDecoders expected format
        const encodedObj = new Map() as Map<CloneableObject, CloneableObject>;

        for (const [key, value] of obj as Map<CloneableObject, CloneableObject>) {
            const k = cloneObject(key);
            encodedObj.set(k, cloneObject(value));
        }
        return encodedObj as Map<CloneableObject & keyof any, CloneableObject> & T;
    }

    if (obj instanceof Date) {
        return new Date(obj) as T;
    }

    if (typeof obj === 'object' && obj !== null) {
        return Object.defineProperties(Object.create(Object.getPrototypeOf(obj)), Object.getOwnPropertyDescriptors({ ...obj }));
    }

    // Singular value
    return obj;
}
