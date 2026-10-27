import { Database } from './Database.js';
import type { Model } from './Model.js';

export class ManyToOneRelation<Key extends keyof any, M extends Model> {
    model: { new (): M } & typeof Model;

    /**
     * E.g. addressId
     */
    foreignKey: string;

    /**
     * E.g. address
     */
    modelKey: Key;

    constructor(model: { new (): M } & typeof Model, modelKey: Key) {
        this.model = model;
        this.modelKey = modelKey;
    }

    /// Whether this relation is loaded
    isLoaded(model: Model) {
        return (model as any)[this.modelKey] !== undefined;
    }

    /// Whether this relation is set
    isSet(model: Model): boolean /* model is Model & Record<Key, M> */ {
        return (model as any)[this.modelKey] !== undefined && (model as any)[this.modelKey] !== null;
    }

    /// Generate a join query
    joinQuery(namespaceA: string, namespaceB: string): string {
        return `LEFT JOIN ${this.model.table} as ${namespaceB} on ${namespaceB}.${this.model.primary.name} = ${namespaceA}.${this.foreignKey}\n`;
    }

    /// Load the relation of a list of models
    async load<A extends Model>(modelsA: A[]): Promise<(A & Record<Key, M>)[]> {
        if (modelsA.length === 0) {
            return [];
        }
        let str = `SELECT ${this.model.getDefaultSelect()} FROM ${this.model.table}\n`;
        str += `WHERE ${this.model.primary.name} IN (?)`;

        const [rows] = await Database.select(str, [modelsA.map(m => m[this.foreignKey])]);
        const modelsB = this.model.fromRows(rows, this.model.table) as M[];

        for (const model of modelsA) {
            const found = modelsB.find(m => m.getPrimaryKey() === model[this.foreignKey]);
            if (!found) {
                throw new Error('Could not load many to one relation: no match found when loading');
            }
            model.setRelation(this, found);
        }
        return modelsA as (A & Record<Key, M>)[];
    }
}
