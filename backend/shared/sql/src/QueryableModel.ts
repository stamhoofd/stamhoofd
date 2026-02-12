import { Model, SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { SQLSelect } from './SQLSelect.js';
import { SQL } from './SQL.js';
import { SQLDelete } from './SQLDelete.js';
import { SQLUpdate } from './SQLUpdate.js';
import { SQLInsert } from './SQLInsert.js';
import { SQLExpression } from './SQLExpression.js';

export class QueryableModel extends Model {
    static select<T extends typeof Model>(this: T, ...columns: (SQLExpression | string)[]): SQLSelect<InstanceType<T>> {
        const transformer = (row: SQLResultNamespacedRow): InstanceType<T> => {
            const d = (this as T).fromRow(row[this.table] as any) as InstanceType<T> | undefined;

            if (!d) {
                console.error('Could not transform row', row, 'into model', this.table, 'check if the primary key is returned in the query');
                throw new Error('Missing data for model ' + this.table);
            }

            return d;
        };

        const select = new SQLSelect(transformer, ...(columns.length === 0 ? [SQL.wildcard()] : columns));
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
        this.copyFrom(me);
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

    /**
     * Get a model by its primary key
     * @param id primary key
     */
    static override async getByID<T extends typeof Model>(this: T, id: number | string): Promise<InstanceType<T> | undefined> {
        return ((await (this as any as typeof QueryableModel).select().where(this.primary.name, id).first(false)) ?? undefined) as any as InstanceType<T> | undefined;
    }

    /**
     * Get multiple models by their ID
     * @param ids primary key of the models you want to fetch
     */
    static override async getByIDs<T extends typeof Model>(this: T, ...ids: (number | string)[]): Promise<InstanceType<T>[]> {
        if (ids.length === 0) {
            return [];
        }

        return (this as any as typeof QueryableModel).select().where(this.primary.name, ids).limit(ids.length).fetch() as any as InstanceType<T>[];
    }
}
