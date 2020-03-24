import { Model } from './Model'
import { Database } from './Database'

export class ManyToManyRelation<Key extends keyof any, A extends Model, B extends Model> {
    modelA: { new(): A } & typeof Model
    modelB: { new(): B } & typeof Model

    /**
     * E.g. parents
     */
    modelKey: Key

    /**
     * E.g. _models_parents
     */
    get linkTable(): string {
        return '_' + [this.modelA.table, this.modelB.table].sort().join('_')
    }

    /**
     * e.g. models_id
     */
    get linkKeyA(): string {
        return this.modelA.table + "_" + this.modelA.primaryKey
    }

    /**
     * e.g. parents_id
    */
    get linkKeyB(): string {
        return this.modelB.table + "_" + this.modelB.primaryKey
    }

    /// Generate a join query
    joinQuery(namespaceA: string, namespaceB: string): string {
        const linkNamespace = namespaceA + "_" + namespaceB
        let str = `LEFT JOIN ${this.linkTable} as ${linkNamespace} on ${linkNamespace}.${this.linkKeyA} = ${namespaceA}.${this.modelA.primaryKey}\n`
        str += `LEFT JOIN ${this.modelB.table} as ${namespaceB} on ${linkNamespace}.${this.linkKeyB} = ${namespaceB}.${this.modelB.primaryKey}`
        return str
    }

    constructor(modelA: { new(): A } & typeof Model, modelB: { new(): B } & typeof Model, modelKey: Key) {
        this.modelA = modelA
        this.modelB = modelB
        this.modelKey = modelKey
    }

    /// Whether this relation is loaded
    isLoaded(model: Model): boolean /*model is Model & Record<Key, M>*/ {
        // Also not loaded if null, since it should be an empty array or an array if it is loaded
        return Array.isArray((model as any)[this.modelKey])
    }

    /// isSet doesn't make sens for many to many. It is always set because it isn't optional
    async link(modelA: A, ...modelsB: B[]): Promise<void> {
        if (!modelA.getPrimaryKey()) {
            throw new Error("Cannot link if model isn't saved yet")
        }
        const query = `INSERT INTO ${this.linkTable} (${this.linkKeyA}, ${this.linkKeyB}) VALUES ?`;

        // Nested arrays are turned into grouped lists (for bulk inserts), e.g. [['a', 'b'], ['c', 'd']] turns into ('a', 'b'), ('c', 'd')
        await Database.insert(query, [
            modelsB.map(modelB => [
                modelA.getPrimaryKey(),
                modelB.getPrimaryKey()
            ])
        ])
    }

    async unlink(modelA: A, ...modelsB: B[]): Promise<void> {
        const query = `DELETE FROM ${this.linkTable} WHERE ${this.linkKeyA} = ? AND ${this.linkKeyB} IN (?)`;

        // Arrays are turned into list, e.g. ['a', 'b'] turns into 'a', 'b'
        await Database.delete(query, [
            modelA.getPrimaryKey(),
            modelsB.map(modelB => modelB.getPrimaryKey())
        ])
    }
}