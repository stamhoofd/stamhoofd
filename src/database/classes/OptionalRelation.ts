// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Model } from './Model'
import { ManyToOneRelation } from './ManyToOneRelation';
import { RelationWithForeignKey } from './Relation';

/**
 * An optional relation is always a toOne relation! toMany relations can contain an empty array
 */
export class OptionalRelation<Key extends string, Output extends typeof Model> implements RelationWithForeignKey<Key, InstanceType<Output> | null> {
    relation: ManyToOneRelation<Key, Output>
    modelKey: Key;

    get foreignKey(): string {
        return this.relation.foreignKey
    }
    set foreignKey(val: string) {
        this.relation.foreignKey = val
    }

    constructor(relation: ManyToOneRelation<Key, Output>) {
        this.relation = relation
        this.modelKey = relation.modelKey
    }

    fromRow(row: any): InstanceType<Output> | null {
        return this.relation.fromRow(row)
    }

    getQuery(): string {
        return "LEFT " + this.relation.getQuery()
    }

    prepare(target: any, key) {
        this.relation.prepare?.(target, key)
    }
}