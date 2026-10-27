import type { Decoder, EncodableObject} from '@simonbackx/simple-encoding';
import { EncodeMedium, encodeObject, ObjectData } from '@simonbackx/simple-encoding';

import type {ColumnType} from './ColumnType.js';
import type {DatabaseStoredValue} from './DatabaseStoredValue.js';

export class Column {
    type: ColumnType;
    name: string;
    nullable = false;
    primary = false;

    /**
     * Skip an update when all changed fields have this flag; still included in other writes and inserts.
     */
    skipUpdate = false;
    decoder: Decoder<any> | undefined;
    /** Called with the current value before change detection. Model.beforeSave does not await the result. */
    beforeSave?: (value?: any) => any | Promise<any>;

    // Allow handling of new fields etc
    beforeLoad?: (value?: any) => any;

    private static jsonVersion = 0;

    /**
     * Set the version for new JSON writes (default 0). Reads use the stored version;
     * unversioned legacy JSON falls back to version 0. Encoding uses the Database medium.
     */
    static setJSONVersion(version: number): void {
        Column.jsonVersion = version;
    }

    constructor(type: ColumnType, name: string) {
        this.type = type;
        this.name = name;
    }

    /**
     * @deprecated use to instead
     */
    saveProperty(data: unknown): DatabaseStoredValue {
        return this.to(data);
    }

    isChanged(old: DatabaseStoredValue, now: DatabaseStoredValue): boolean {
        if (old instanceof Date) {
            if (now instanceof Date) {
                return old.getTime() !== now.getTime();
            }
            return true;
        }
        return now !== old;
    }

    /// Convert from database to javascript
    from(data: DatabaseStoredValue): unknown {
        if (this.beforeLoad) {
            data = this.beforeLoad(data);
        }
        if (this.nullable && data === null) {
            return null;
        }
        if (!this.nullable && data === null) {
            throw new Error('Received null value from database. Expected a non-nullable value for ' + this.name);
        }
        switch (this.type) {
            case 'integer':
                // Mapped correctly by MySQL
                if (!Number.isInteger(data)) {
                    throw new Error('Expected integer');
                }
                return data;

            case 'number':
                // Mapped correctly by MySQL
                if (Number.isNaN(data)) {
                    throw new Error('Expected number');
                }
                return data;

            case 'string':
                return data;

            case 'boolean':
                // Mapped correctly by MySQL
                if (data !== 1 && data !== 0) {
                    throw new Error('Expected boolean');
                }
                return data === 1;

            case 'date':
                // Correctly mapped by node MySQL
                return data;

            case 'datetime':
                // Mapped correctly by node MySQL
                return data;

            case 'json': {
                if (typeof data !== 'string') {
                    throw new Error('Expected string for JSON column');
                }

                // Mapped correctly by node MySQL
                let parsed: unknown;
                try {
                    parsed = JSON.parse(data);
                }
                catch (e) {
                    // Syntax error. Mark this in the future.
                    console.error(e);
                    parsed = {};
                }

                if (this.decoder) {
                    if (this.decoder.decodeField) {
                        if (typeof parsed === 'object' && parsed !== null && 'value' in parsed && typeof (parsed as any).version === 'number') {
                            return this.decoder.decodeField(parsed.value, { version: (parsed as any).version, medium: EncodeMedium.Database }, this.name);
                        }

                        // Fallback decoding without version (since we don't know the saved version)
                        return this.decoder.decodeField(parsed, { version: 0, medium: EncodeMedium.Database }, this.name);
                    }
                    if (typeof parsed === 'object' && parsed !== null && 'version' in parsed && 'value' in parsed && typeof parsed.version === 'number') {
                        return this.decoder.decode(new ObjectData(parsed.value, { version: parsed.version, medium: EncodeMedium.Database }, this.name));
                    }

                    // Fallback decoding without version (since we don't know the saved version)
                    return this.decoder.decode(new ObjectData(parsed, { version: 0, medium: EncodeMedium.Database }, this.name));
                }
                else {
                    console.warn('It is recommended to always use a decoder for JSON columns');
                }

                if (typeof parsed === 'object' && parsed !== null && 'version' in parsed && 'value' in parsed && typeof parsed.version === 'number') {
                    return parsed.value;
                }

                // If data comes from before version encoding, fall back to parsed
                return parsed;
            }

            default: {
                // If we get a compile error heres, a type is missing in the switch
                const t: never = this.type;
                throw new Error('Type ' + t + ' not supported');
            }
        }
    }

    /// Convert to database from javascript
    to(data: unknown): DatabaseStoredValue {
        if (this.nullable && data === null) {
            return null;
        }
        if (!this.nullable && data === null) {
            throw new Error('Tried to set null to non-nullable value. Expected a non-nullable value');
        }

        switch (this.type) {
            case 'integer':
                // Mapped correctly by MySQL
                if (typeof data !== 'number') {
                    throw new Error('Expected integer for ' + this.name + ', received ' + (typeof data));
                }

                return data;

            case 'number':
                if (typeof data !== 'number') {
                    throw new Error('Expected number for ' + this.name + ', received ' + (typeof data));
                }

                // Mapped correctly by node MySQL
                return data;

            case 'string':
                if (typeof data !== 'string') {
                    throw new Error('Expected string for ' + this.name + ', received ' + (typeof data));
                }

                return data;

            case 'boolean':
                if (typeof data !== 'boolean') {
                    throw new Error('Expected boolean for ' + this.name + ', received ' + (typeof data));
                }

                return data ? 1 : 0;

            case 'date':
            case 'datetime':
                if (!(data instanceof Date)) {
                    throw new Error('Expected Date for ' + this.name + ', received ' + (typeof data));
                }
                // This information cannot be stored in the database - so also update it in JS to keep it in sync
                data.setMilliseconds(0);

                // Correctly mapped by node MySQL
                return data;

            case 'json': {
                const version = Column.jsonVersion;

                return JSON.stringify({
                    // Warning: keys should be sorted or they will get marked as changed every time
                    value: encodeObject(data as EncodableObject, { version, medium: EncodeMedium.Database }),
                    version: version,

                });
            }

            default: {
                // If we get a compile error heres, a type is missing in the switch
                const t: never = this.type;
                throw new Error('Type ' + t + ' not supported');
            }
        }
    }
}
