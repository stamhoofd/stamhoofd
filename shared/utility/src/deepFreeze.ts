export function deepFreeze(object: unknown) {
    // Retrieve the property names defined on object
    if (Array.isArray(object)) {
        Object.freeze(object);

        for (const item of object) {
            deepFreeze(item);
        }
        return;
    }

    if (object instanceof Map) {
        object.forEach((value, key) => {
            deepFreeze(key);
            deepFreeze(value);
        });
        Object.freeze(object);
        return;
    }

    // Freeze properties before freezing self
    if (typeof object === 'object' && object !== null) {
        for (const key in object) {
            const value: unknown = object[key];

            if (typeof value === 'object' && value !== null) {
                deepFreeze(value);
            }
        }
        Object.freeze(object);
        return;
    }
}
