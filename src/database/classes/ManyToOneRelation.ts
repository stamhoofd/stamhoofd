import { Model } from "./Model";

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
    isLoaded(model: Model): boolean /*model is Model & Record<Key, M>*/ {
        return (model as any)[this.modelKey] !== undefined;
    }

    /// Whether this relation is set
    isSet(model: Model): boolean /*model is Model & Record<Key, M>*/ {
        return (model as any)[this.modelKey] !== undefined && (model as any)[this.modelKey] !== null;
    }

    /// Generate a join query
    joinQuery(namespaceA: string, namespaceB: string): string {
        return `LEFT JOIN ${this.model.table} as ${namespaceB} on ${namespaceB}.${this.model.primary.name} = ${namespaceA}.${this.foreignKey}\n`;
    }
}
