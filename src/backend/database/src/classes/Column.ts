import { Decoder, isEncodeable,ObjectData } from '@stamhoofd-common/encoding';

import { ColumnType } from "../decorators/Column";

export class Column {
    type: ColumnType;
    name: string;
    nullable = false;
    primary = false;
    decoder: Decoder<any> | undefined;

    constructor(type: ColumnType, name: string) {
        this.type = type;
        this.name = name;
    }

    saveProperty(data: any): any {
        return this.to(data);
    }

    isChanged(old: any, now: any): boolean {
        return this.saveProperty(now) !== old;
    }

    /// Convert from database to javascript
    from(data: any): any {
        if (this.nullable && data === null) {
            return null;
        }
        if (!this.nullable && data === null) {
            throw new Error("Received null value from database. Expected a non-nullable value for " + this.name);
        }
        switch (this.type) {
            case "integer":
                // Mapped correctly by MySQL
                if (!Number.isInteger(data)) {
                    throw new Error("Expected integer");
                }
                return data;

            case "string":
                return data;

            case "boolean":
                // Mapped correctly by MySQL
                if (data !== 1 && data !== 0) {
                    throw new Error("Expected boolean");
                }
                return data === 1;

            case "date":
                // Correctly mapped by node MySQL
                return data;

            case "datetime":
                // Mapped correctly by node MySQL
                return data;

            case "json": {
                // Mapped correctly by node MySQL
                let parsed: any
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    // Syntax error. Mark this in the future.
                    console.error(e);
                    parsed = {}
                }

                if (this.decoder) {
                    return this.decoder.decode(new ObjectData(parsed, this.name));
                } else {
                    console.warn("It is recommended to always use a decoder for JSON columns");
                }

                return parsed;
            }

            default: {
                // If we get a compile error heres, a type is missing in the switch
                const t: never = this.type;
                throw new Error("Type " + t + " not supported");
            }
        }
    }

    /// Convert to database from javascript
    to(data: any): any {
        if (this.nullable && data === null) {
            return null;
        }
        if (!this.nullable && data === null) {
            throw new Error("Tried to set null to non-nullable value. Expected a non-nullable value");
        }

        switch (this.type) {
            case "integer":
                // Mapped correctly by MySQL
                return data;

            case "string":
                return data;

            case "boolean":
                return data ? 1 : 0;

            case "date":
                // Correctly mapped by node MySQL
                return data;

            case "datetime":
                // Mapped correctly by node MySQL
                return data;

            case "json": {
                let d = data
                if (isEncodeable(data)) {
                    d = data.encode();
                } else {
                    console.warn("A non encodeable value has been set for " + this.name + " this is not recommended and might become deprecated in the future.");
                }
                return JSON.stringify(d);
            }

            default: {
                // If we get a compile error heres, a type is missing in the switch
                const t: never = this.type;
                throw new Error("Type " + t + " not supported");
            }
        }
    }
}
