import { Model, SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { SQLSelect } from './SQLSelect';
import { SQL } from './SQL';
import { SQLDelete } from './SQLDelete';
import { SQLUpdate } from './SQLUpdate';
import { SQLInsert } from './SQLInsert';

export class QueryableModel extends Model {
    static select<T extends typeof Model>(this: T): SQLSelect<InstanceType<T>> {
        const transformer = (row: SQLResultNamespacedRow): InstanceType<T> => {
            const d = (this as T).fromRow(row[this.table] as any) as InstanceType<T> | undefined;

            if (!d) {
                throw new Error('EmailTemplate not found');
            }

            return d;
        };

        const select = new SQLSelect(transformer, SQL.wildcard());
        return select.from(SQL.table(this.table));
    }

    static delete(): SQLDelete {
        return SQL.delete().from(SQL.table(this.table));
    }

    static update(): SQLUpdate {
        return SQL.update(SQL.table(this.table));
    }

    static insert(): SQLInsert {
        return SQL.insert(SQL.table(this.table));
    }
}
