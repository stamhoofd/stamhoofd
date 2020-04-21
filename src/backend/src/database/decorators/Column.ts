import { Model } from "../classes/Model";
import { ManyToOneRelation } from "../classes/ManyToOneRelation";
import { Column } from "../classes/Column";
import { Decoder } from '@stamhoofd/backend/src/structs/classes/Decoder';

export type ColumnType = "integer" | "string" | "date" | "datetime" | "boolean" | "json";

export function column<Key extends keyof any, Value extends Model>(settings: {
    type: ColumnType;
    primary?: boolean;
    nullable?: boolean;
    decoder?: Decoder<any>;
    foreignKey?: ManyToOneRelation<Key, Value>;
}) {
    return (target: any /* future typeof Model */, key: string) => {
        if (!target.constructor.columns) {
            target.constructor.columns = new Map<string, Column>();
        }

        if (settings.foreignKey) {
            settings.foreignKey.foreignKey = key;

            if (!target.constructor.relations) {
                target.constructor.relations = [];
            }

            target.constructor.relations.push(settings.foreignKey);
        }

        const column = new Column(settings.type, key);
        if (settings.decoder) {
            column.decoder = settings.decoder
        }

        if (settings.nullable) {
            column.nullable = true;
        }
        if (settings.primary) {
            if (target.constructor.primary) {
                throw new Error("Duplicate primary column " + key);
            }
            target.constructor.primary = column;
            column.primary = true;
        }

        target.constructor.columns.set(key, column);
    };
}
