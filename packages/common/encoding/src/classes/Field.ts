import { PatchOrPutDecoder } from '../structs/PatchOrPutDecoder.js';
import { PatchableDecoder } from './AutoEncoder.js';

export class Field<T> {
    optional: boolean;
    nullable: boolean;
    decoder: PatchableDecoder<T>;

    /**
     * Set to true if you want to force encoding of the field, even for default values
     * when saved to Database medium
     */
    queryable: boolean = false;

    /**
     * Executed after decoding / before encoding to convert to a correct internal value (= latest version)
     */
    upgrade?: (old: any) => any;
    downgrade?: (newer: any) => any;

    upgradePatch?: (old: any) => any;
    downgradePatch?: (newer: any) => any;

    /**
     * Version in which this field was added
     */
    version: number;

    /**
     * Name of the property where to save / get this value
     */
    property: string;

    /**
     * Name in the encoded version
     */
    field: string;

    /**
     * Name in the encoded version
     */
    fieldAlias?: string;

    /**
     * Internal value for unsupported versions
     */
    defaultValue?: () => any;
    isDefaultValue?: (val: unknown) => boolean;

    /**
     * Internal value for unsupported versions
     */
    patchDefaultValue?: () => any;

    /**
     * Optimization during encoding/decoding.
     * Whether there is a newer field with a higher version for this property
     */
    hasNewerField = false;

    getOptionalClone() {
        const field = new Field();
        field.optional = true;
        field.queryable = this.queryable;
        field.nullable = this.nullable;
        field.decoder = this.decoder;
        field.version = this.version;
        field.property = this.property;
        field.field = this.field;
        field.hasNewerField = this.hasNewerField;

        if (this.upgrade) {
            const upg = this.upgrade;
            field.upgrade = (oldValue) => {
                if (oldValue !== undefined) {
                    // Value is set, we need an upgrade
                    return upg(oldValue);
                }
                else {
                    // No value is set, we don't need an upgrade
                    return undefined;
                }
            };
        }

        if (this.downgrade) {
            const dwn = this.downgrade;
            field.downgrade = (newValue) => {
                if (newValue !== undefined) {
                    // Value is set, we need an upgrade
                    return dwn(newValue);
                }
                else {
                    // No value is set, we don't need an upgrade
                    return undefined;
                }
            };
        }

        if (this.upgradePatch) {
            field.upgrade = this.upgradePatch;
        }

        if (this.downgradePatch) {
            field.downgrade = this.downgradePatch;
        }

        field.upgradePatch = this.upgradePatch;
        field.downgradePatch = this.downgradePatch;
        field.patchDefaultValue = this.patchDefaultValue;

        field.defaultValue = undefined; // do not copy default values. Patches never have default values, unless for patchable arrays
        field.isDefaultValue = undefined;

        const aDecoder = this.decoder as any;

        // Do we have a custom patch decoder? (this can be configured in the decoder)
        if (aDecoder.patchType) {
            field.upgrade = this.upgradePatch;
            field.downgrade = this.downgradePatch;
            const patchDecoder = aDecoder.patchType();
            field.decoder = new PatchOrPutDecoder(aDecoder, patchDecoder);
        }

        if (aDecoder.patchDefaultValue) {
            // e.g. for patchable arrays we always set a default value
            field.defaultValue = () => {
                return aDecoder.patchDefaultValue();
            };

            if (aDecoder.isPatchDefaultValue) {
                field.isDefaultValue = (value: unknown) => {
                    return aDecoder.isPatchDefaultValue(value);
                };
            }
        }

        if (this.patchDefaultValue) {
            field.defaultValue = this.patchDefaultValue;
            field.isDefaultValue = undefined; // not yet supporrted
        }

        return field;
    }
}
