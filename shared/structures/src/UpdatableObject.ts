export interface UpdatableObject {
    updateFrom<T extends UpdatableObject>(this: T, obj: T);
}

export function isUpdatableObject(t: unknown): t is UpdatableObject {
    return t !== null && typeof t === 'object' && 'updateFrom' in t && typeof t.updateFrom === 'function';
}
