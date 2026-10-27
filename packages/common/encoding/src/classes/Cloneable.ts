export interface Cloneable {
    clone<T extends this>(this: T): this;
}

export function isCloneable(object: any): object is Cloneable {
    if (typeof object !== 'object' || object === null) {
        return false;
    }
    return !!object.clone;
}

export type CloneableObject = Cloneable | CloneableObject[] | Map<CloneableObject, CloneableObject> | string | number | { [key: string]: CloneableObject } | boolean | undefined | null | Date;

/**
 * Use this method to encode an object (might be an encodeable implementation) into a decodable structure
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
        return Object.assign(Object.create(obj.constructor.prototype), obj);
    }

    // Singular value
    return obj;
}
