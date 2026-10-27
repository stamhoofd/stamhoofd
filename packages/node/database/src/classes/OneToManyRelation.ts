import { Database } from './Database.js';
import type { Model } from './Model.js';

export class OneToManyRelation<Key extends keyof any, A extends Model, B extends Model> {
    modelA: { new (): A } & typeof Model;
    modelB: { new (): B } & typeof Model;

    /**
     * Foreign key of the other model that references the current model
     */
    foreignKey: keyof B;

    /**
     * E.g. categories
     */
    modelKey: Key;

    /**
     * Sort the loading of this relation
     */
    sortKey: keyof B | undefined;
    sortOrder: 'ASC' | 'DESC' = 'ASC';

    constructor(modelA: { new (): A } & typeof Model, modelB: { new (): B } & typeof Model, modelKey: Key, foreignKey: keyof B) {
        this.modelA = modelA;
        this.modelB = modelB;
        this.modelKey = modelKey;
        this.foreignKey = foreignKey;
    }

    setSort(key: keyof B, order: 'ASC' | 'DESC' = 'ASC'): this {
        this.sortKey = key;
        this.sortOrder = order;
        return this;
    }

    /// Whether this relation is loaded
    isLoaded<T extends A>(model: T): model is T & Record<Key, B[]> {
        // Also not loaded if null, since it should be an empty array or an array if it is loaded
        return Array.isArray((model as any)[this.modelKey]);
    }

    /**
     * Generate a join query
     * @param namespaceA namespace in the SQL query of modelA
     * @param namespaceB namespace in the SQL query of modelB
     */
    joinQuery(namespaceA: string, namespaceB: string): string {
        return `LEFT JOIN ${this.modelB.table} as ${namespaceB} on ${namespaceB}.${this.foreignKey.toString()} = ${namespaceA}.${this.modelA.primary.name}\n`;
    }

    orderByQuery(namespaceB: string): string {
        if (this.sortKey === undefined) {
            return '';
        }
        let str = `\nORDER BY ${namespaceB}.${this.sortKey.toString()}`;
        if (this.sortOrder === 'DESC') {
            str += ' DESC';
        }
        return str + '\n';
    }

    /// Load the relation of a model and return the loaded models
    async load(modelA: A, sorted = true, where?: object): Promise<B[]> {
        const namespaceB = 'B';
        let str = `SELECT ${this.modelB.getDefaultSelect(namespaceB)} FROM ${this.modelB.table} as ${namespaceB}\n`;
        str += `WHERE ${namespaceB}.${this.foreignKey.toString()} = ?`;

        const params = [modelA.getPrimaryKey()];
        if (where) {
            for (const key in where) {
                if (Object.hasOwnProperty.call(where, key)) {
                    str += ` AND ${namespaceB}.\`${key}\` = ?`;
                    params.push(where[key] as string);
                }
            }
        }
        if (sorted) {
            str += this.orderByQuery('B');
        }

        const [rows] = await Database.select(str, params);
        const modelsB = this.modelB.fromRows(rows, namespaceB) as B[];
        modelA.setManyRelation(this, modelsB);
        return modelsB;
    }
}
