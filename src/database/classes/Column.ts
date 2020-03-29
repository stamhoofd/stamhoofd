import { ColumnType } from "../decorators/Column";

export class Column {
    type: ColumnType;
    name: string;
    nullable = false;
    primary = false;

    constructor(type: ColumnType, name: string) {
        this.type = type;
        this.name = name;
    }

    /// Convert from database to javascript
    from(data: any): any {
        if (this.nullable && data === null) {
            return null;
        }
        if (!this.nullable && data === null) {
            throw new Error("Received null value from database. Expected a non-nullable value");
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

            default: {
                // If we get a compile error heres, a type is missing in the switch
                const t: never = this.type;
                throw new Error("Type " + t + " not supported");
            }
        }
    }
}
