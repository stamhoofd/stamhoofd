import { type ComponentPublicInstance, isRef, warn } from 'vue';

export function injectHooks(instanceProxy: ComponentPublicInstance, definitions: Record<string, any>) {
    const ctx = (instanceProxy.$ as any).ctx;

    for (const key in definitions) {
        // ref on how to extend a proxy context: core/packages/runtime-core/src/componentOptions.ts
        if (!isRef(definitions[key])) {
            ctx[key] = definitions[key];
        }
        else {
            const val = definitions[key];
            Object.defineProperty(ctx, key, {
                enumerable: true,
                configurable: true,
                get: () => {
                    return val.value;
                },
                set: () => {
                    warn(`Cannot assign to '${key}' of navigation mixin. This is a read-only property.`);
                },
            });
        }
    }
}
