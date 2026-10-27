import type { Decoder } from '@simonbackx/simple-encoding';

import { Column } from '../classes/Column.js';
import type { ManyToOneRelation } from '../classes/ManyToOneRelation.js';
import type { Model } from '../classes/Model.js';
import type {ColumnType} from '../classes/ColumnType.js';

/** Maps a property to a database column; does not create or migrate the SQL schema. */
export function column<Key extends keyof any, Value extends Model>(settings: {
    type: ColumnType;
    primary?: boolean;
    nullable?: boolean;
    /** Decoder for JSON values, stored with their encoding version using the Database medium. */
    decoder?: Decoder<any>;
    /**
     * For existing rows, changes consisting only of skipUpdate columns do not trigger SQL.
     * These columns are still written alongside other changes, and on insert.
     */
    skipUpdate?: boolean;
    /** Synchronous transform before each save attempt; receives the current property value. */
    beforeSave?: (value?: any) => any;
    beforeLoad?: (value?: any) => any;
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
        column.beforeSave = settings.beforeSave;
        column.beforeLoad = settings.beforeLoad;

        if (settings.decoder) {
            column.decoder = settings.decoder;
        }

        if (settings.nullable) {
            column.nullable = true;
        }

        if (settings.skipUpdate !== undefined) {
            column.skipUpdate = settings.skipUpdate;
        }
        if (settings.primary) {
            if (target.constructor.primary) {
                throw new Error('Duplicate primary column ' + key);
            }
            target.constructor.primary = column;
            column.primary = true;
        }

        target.constructor.columns.set(key, column);
    };
}
