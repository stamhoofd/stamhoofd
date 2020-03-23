// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Model } from './Model'
import { ManyToOneRelation } from './ManyToOneRelation';
import { ToOneRelation } from './Relation';
import { Query } from './Query';

/**
 * An optional relation is always a toOne relation! toMany relations can contain an empty array
 */
export class OptionalRelation<Key extends string, A, B extends Model> implements ToOneRelation<Key, A, B | null> {
    relation: ToOneRelation<Key, A, B>
    modelKey: Key;

    get foreignKey(): string {
        return this.relation.foreignKey
    }
    set foreignKey(val: string) {
        this.relation.foreignKey = val
    }

    constructor(relation: ToOneRelation<Key, A, B>) {
        this.relation = relation
        this.modelKey = relation.modelKey
    }

    query(model: A & Model): Query<B | null> {
        throw new Error("Method not implemented.");
    }

    fromRow(row: any): B | null {
        // Todo: we need to implement this!

        /*
        if (row[w.modelKey][w.model.primaryKey] !== null) {
            model[w.modelKey] = w.model.fromRow(row[w.modelKey])
        } else {
            console.log("Relation " + w.modelKey + " not set")

            // Mark the relation as loaded (by setting it to null, since it is an optional relation)
            // undefined = not loaded, null = loaded but not set
            model[w.modelKey] = null;
        }
        */
        return this.relation.fromRow(row)
    }

    getJoin(): string {
        return "LEFT " + this.relation.getJoin()
    }

    prepare(target: any, key) {
        this.relation.prepare?.(target, key)
    }
}