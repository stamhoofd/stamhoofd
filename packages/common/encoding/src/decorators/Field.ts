import { SimpleError } from '@simonbackx/simple-errors';
import { PatchableDecoder } from '../classes/AutoEncoder.js';
import { Field } from '../classes/Field.js';

/** Declares an AutoEncoder property and its encoded representation. */
export function field<T>(settings: {
    /** Allows a missing value without a default to remain undefined. Defaults to false. */
    optional?: boolean;
    /** Accepts null and defaults missing required values to null. Defaults to false. */
    nullable?: boolean;
    queryable?: boolean;
    /** Decodes the property's value; use nullable instead of wrapping this in NullableDecoder. */
    decoder: PatchableDecoder<T>;
    /** Factory for missing values, taking precedence over constructor initializers. */
    defaultValue?: () => any;
    isDefaultValue?: (value: unknown) => boolean;
    patchDefaultValue?: () => any;

    /**
     * Converts the preceding decoded definition to this version's value.
     * Called in ascending version order when decoding older data, including
     * undefined for a newly introduced field. A regular function receives the instance as this.
     */
    upgrade?: (old: any) => any;
    /** Converts this definition to the preceding one when encoding an older version. */
    downgrade?: (newer: any) => any;

    /** Patch-specific upgrade; preserve undefined to avoid introducing unintended changes. */
    upgradePatch?: (old: any) => any;
    /** Patch-specific downgrade for fields whose patch representation differs from the value. */
    downgradePatch?: (newer: any) => any;

    /**
     * Version in which this field definition was added. Defaults to 0.
     */
    version?: number;

    /**
     * Encoded key name. Defaults to the property name; changing the property name
     * while retaining this key does not change the stored format.
     */
    field?: string;
}) {
    return (target: any /* future typeof Model */, key: string) => {
        if (!target.constructor.fields || !Object.hasOwn(target.constructor as object, 'fields')) {
            target.constructor.fields = target.constructor.fields?.slice(0) ?? [];
            target.constructor.fields.createdFor = target.constructor;

            target.constructor.cachedPatchType = undefined;

            // Reset caches
            // Override parent definitions
            target.constructor.__latestVersion = undefined;
            target.constructor.__latestFields = undefined;
            target.constructor.__fieldsForVersion = new Map();
            target.constructor.__cachedInstance = undefined;
        }

        const field = new Field<T>();
        field.optional = settings.optional ?? false;
        field.nullable = settings.nullable ?? false;
        field.queryable = settings.queryable ?? false;
        field.decoder = settings.decoder;
        field.version = settings.version ?? 0;
        field.field = settings.field ?? key;
        field.upgrade = settings.upgrade;
        field.downgrade = settings.downgrade;
        field.upgradePatch = settings.upgradePatch;
        field.downgradePatch = settings.downgradePatch;
        field.defaultValue = settings.defaultValue;
        field.isDefaultValue = settings.isDefaultValue;
        field.patchDefaultValue = settings.patchDefaultValue;
        field.property = key;

        target.constructor.fields.push(field);
        // target.constructor.latestVersion = Math.max(target.constructor.latestVersion ?? 0, settings.version ?? 0);
        target.constructor.sortFields();

        const allFields = (target.constructor.fields as unknown as Field<unknown>[]).filter(f => f.property === key);

        const propertyLatestVersion = Math.max(0, ...allFields.map(f => f.version));

        for (const f of allFields) {
            f.hasNewerField = (f.version) < propertyLatestVersion;
        }

        // Security check
        if (allFields.find(f => f !== field && !!f.defaultValue !== !!field.defaultValue)) {
            throw new SimpleError({
                code: 'missing_default_value',
                message: 'When you define defaultValue for at least one version of a property, you need to set if for each version. For property: ' + field.property,
                field: field.property,
            });
        }
    };
}
