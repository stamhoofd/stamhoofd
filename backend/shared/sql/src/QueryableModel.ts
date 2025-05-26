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

    async refresh() {
        const { fields, skipUpdate } = this.getChangedDatabaseProperties();

        if (Object.keys(fields).length > skipUpdate) {
            throw new Error('Cannot refresh a model that has unsaved changes');
        }

        const me = await (this.static as typeof QueryableModel).select().where(this.static.primary.name, this.getPrimaryKey()).first(true);

        for (const column of this.static.columns.values()) {
            this[column.name] = me[column.name];
        }
    }

    static async refreshAll<T extends typeof QueryableModel>(this: T, list: InstanceType<T>[]) {
        // Cut up in batches of max 100
        const batchSize = 100;
        for (let i = 0; i < list.length; i += batchSize) {
            const batch = list.slice(i, i + batchSize);
            const ids = list.map(item => item.getPrimaryKey()).filter(id => id !== null);
            if (ids.length === 0) {
                continue;
            }

            const refreshed = await this.getByIDs(...ids);

            for (const item of batch) {
                const refreshedItem = refreshed.find(r => r.getPrimaryKey() === item.getPrimaryKey());
                if (refreshedItem) {
                    for (const column of this.columns.values()) {
                        item[column.name] = refreshedItem[column.name];
                    }
                }
            }
        }
    }
}
