import { Database } from "./Database";
import { Model } from "./Model";

export class ManyToManyRelation<Key extends keyof any, A extends Model, B extends Model> {
    modelA: { new(): A } & typeof Model;
    modelB: { new(): B } & typeof Model;

    /**
     * E.g. parents
     */
    modelKey: Key;

    /**
     * E.g. _models_parents
     */
    get linkTable(): string {
        return "_" + [this.modelA.table, this.modelB.table].sort().join("_");
    }

    /**
     * e.g. models_id
     */
    get linkKeyA(): string {
        return (
            this.modelA.table +
            this.modelA.primary.name.charAt(0).toUpperCase() +
            this.modelA.primary.name.substring(1) +
            ((this.modelA as any) === this.modelB ? "A" : "")
        );
    }

    /**
     * e.g. parents_id
     */
    get linkKeyB(): string {
        return (
            this.modelB.table +
            this.modelB.primary.name.charAt(0).toUpperCase() +
            this.modelB.primary.name.substring(1) +
            ((this.modelA as any) === this.modelB ? "B" : "")
        );
    }

    /// Generate a join query
    joinQuery(namespaceA: string, namespaceB: string): string {
        const linkNamespace = namespaceA + "_" + namespaceB;
        let str = `LEFT JOIN ${this.linkTable} as ${linkNamespace} on ${linkNamespace}.${this.linkKeyA} = ${namespaceA}.${this.modelA.primary.name}\n`;
        str += `LEFT JOIN ${this.modelB.table} as ${namespaceB} on ${linkNamespace}.${this.linkKeyB} = ${namespaceB}.${this.modelB.primary.name}`;
        return str;
    }

    /// Load the relation of a model and return the loaded models
    async load(modelA: A): Promise<B[]> {
        const namespaceB = "B";
        const linkNamespace = "AB";
        let str = `SELECT ${this.modelB.getDefaultSelect(namespaceB)} FROM ${this.linkTable} as ${linkNamespace}\n`;
        str += `JOIN ${this.modelB.table} as ${namespaceB} on ${linkNamespace}.${this.linkKeyB} = ${namespaceB}.${this.modelB.primary.name}\n`;
        str += `WHERE ${linkNamespace}.${this.linkKeyA} = ?`;
        const [rows] = await Database.select(str, [modelA.getPrimaryKey()]);
        const modelsB = this.modelB.fromRows(rows, namespaceB) as B[];
        modelA.setManyRelation(this, modelsB);
        return modelsB;
    }

    constructor(modelA: { new(): A } & typeof Model, modelB: { new(): B } & typeof Model, modelKey: Key) {
        this.modelA = modelA;
        this.modelB = modelB;
        this.modelKey = modelKey;
    }

    /// Whether this relation is loaded
    isLoaded(model: A): model is A & Record<Key, B[]> {
        // Also not loaded if null, since it should be an empty array or an array if it is loaded
        return Array.isArray((model as any)[this.modelKey]);
    }

    /// isSet doesn't make sens for many to many. It is always set because it isn't optional
    async link(modelA: A, ...modelsB: B[]): Promise<void> {
        if (!modelA.getPrimaryKey()) {
            throw new Error("Cannot link if model is not saved yet");
        }

        for (const modelB of modelsB) {
            if (!modelB.getPrimaryKey()) {
                throw new Error("Cannot link to a model that is not saved yet");
            }
        }
        const query = `INSERT INTO ${this.linkTable} (${this.linkKeyA}, ${this.linkKeyB}) VALUES ?`;

        // Nested arrays are turned into grouped lists (for bulk inserts), e.g. [['a', 'b'], ['c', 'd']] turns into ('a', 'b'), ('c', 'd')
        const [result] = await Database.insert(query, [
            modelsB.map(modelB => [modelA.getPrimaryKey(), modelB.getPrimaryKey()])
        ]);

        // If the relation is loaded, also modify the value of the relation
        if (this.isLoaded(modelA)) {
            if (result.affectedRows == modelsB.length) {
                const arr: B[] = (modelA as any)[this.modelKey];
                arr.push(...modelsB);
            } else {
                // This could happen in race conditions and simultanious requests

                console.warn(
                    "Warning: linking expected to affect " +
                    modelsB.length +
                    " rows, but only affected " +
                    result.affectedRows +
                    " rows"
                );

                // TODO: Manually correct by doing a query (safest)
                throw new Error("Fallback behaviour net yet implemented");
            }
        }
    }

    /**
     * Delete all the links from modelA for this relation
     * @param modelA
     */
    async clear(modelA: A): Promise<void> {
        const query = `DELETE FROM ${this.linkTable} WHERE ${this.linkKeyA} = ?`;

        // Arrays are turned into list, e.g. ['a', 'b'] turns into 'a', 'b'
        const [result] = await Database.delete(query, [modelA.getPrimaryKey()]);

        if (result.affectedRows == 0) {
            console.warn("Cleared many to many relation, but didn't deleted any entries");
        }

        modelA.setManyRelation(this, []);
    }

    async unlink(modelA: A, ...modelsB: B[]): Promise<void> {
        const query = `DELETE FROM ${this.linkTable} WHERE ${this.linkKeyA} = ? AND ${this.linkKeyB} IN (?)`;

        // Arrays are turned into list, e.g. ['a', 'b'] turns into 'a', 'b'
        const [result] = await Database.delete(query, [
            modelA.getPrimaryKey(),
            modelsB.map(modelB => modelB.getPrimaryKey())
        ]);

        if (this.isLoaded(modelA)) {
            if (result.affectedRows == modelsB.length) {
                const arr: B[] = (modelA as any)[this.modelKey];
                const idMap = modelsB.map(model => model.getPrimaryKey());
                modelA.setManyRelation(
                    this,
                    arr.filter(model => {
                        return !idMap.includes(model.getPrimaryKey());
                    })
                );
            } else {
                // This could happen in race conditions and simultanious requests
                console.warn(
                    "Warning: unlinking expected to affect " +
                    modelsB.length +
                    " rows, but only affected " +
                    result.affectedRows +
                    " rows"
                );

                // TODO: Manually correct by doing a query (safest)
                throw new Error("Fallback behaviour net yet implemented");
            }
        }
    }
}
