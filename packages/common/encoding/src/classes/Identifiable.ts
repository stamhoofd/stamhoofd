export type NonScalarIdentifiable<P extends string | number> = { id: P };
/** Object identity used to target array operations without depending on indexes. */
export type Identifiable<P extends string | number> = NonScalarIdentifiable<P>;

export type NonScalarIdentifiableType<T> = T extends { id: infer P }
    ? P extends string | number
        ? P
        : never
    : never;

export function hasId(val: any): val is Identifiable<string | number> {
    return typeof val === 'object' && val !== null && val.id !== undefined;
}

export function getId<P extends string | number>(val: Identifiable<P> | P): P {
    if (hasId(val)) {
        return val.id;
    }
    return val;
}

export function getOptionalId<T>(val: T): string | number | T {
    if (hasId(val)) {
        return val.id;
    }
    return val;
}
