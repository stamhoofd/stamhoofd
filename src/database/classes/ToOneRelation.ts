// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Model } from './Model'

export type RelationLoaded<T extends Relation<string, any>> = T extends Relation<infer Key, infer Output> ? Record<Key, Output> : never
/**
 * Specify non null relation
 */
export type RelationSet<T extends Relation<string, any>> = T extends Relation<infer Key, infer Output> ? Record<Key, NonNullable<Output>> : never

export interface Relation<Key extends string, Output> {
    /** key where the relation is saved */
    modelKey: Key;

    fromRow(row: any): Output;
    getQuery(): string;
    prepare?(target: any, key);
}

export type RelationWithForeignKey<Key extends string, Output> = Relation<Key, Output> & { foreignKey: string }

/**
 * An optional relation is always a toOne relation! toMany relations can contain an empty array
 */
export class OptionalRelation<Key extends string, Output extends typeof Model> implements RelationWithForeignKey<Key, InstanceType<Output> | null> {
    relation: ToOneRelation<Key, Output>
    modelKey: Key;

    get foreignKey(): string {
        return this.relation.foreignKey
    }
    set foreignKey(val: string) {
        this.relation.foreignKey = val
    }

    constructor(relation: ToOneRelation<Key, Output>) {
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

export class ToOneRelation<Key extends string, T extends typeof Model> implements RelationWithForeignKey<Key, InstanceType<T>> {
    /** The key where the referenced primary key is saved */
    foreignKey: string

    /** key where the relation is saved */
    modelKey: Key

    /** Model of the referenced table */
    model: T

    constructor(model: T, modelKey: Key, foreignKey?: string) {
        this.model = model
        this.modelKey = modelKey
        if (foreignKey) {
            this.foreignKey = foreignKey
        }
    }

    fromRow(row: any): InstanceType<T> {
        if (row[this.modelKey][this.model.primaryKey] !== null) {
            return this.model.fromRow(row[this.modelKey])
        }
        throw new Error("Expected relation to be loaded");
    }

    getQuery(): string {
        if (this.foreignKey === undefined) {
            throw new Error("ToOneRelation " + this.modelKey + " has no foreign key set. Please make sure you added a @column which references this relation!")
        }

        return `JOIN \`${this.model.table}\` as \`${this.modelKey}\` ON \`${this.modelKey}\`.\`${this.model.primaryKey}\` = \`this\`.\`${this.foreignKey}\``;
    }

    prepare?(target: any, key) {
        console.log("Perpare called");
        if (this.foreignKey && this.foreignKey != key) {
            throw new Error("Cannot set same relation for different foreign key (while setting relation of key " + this.foreignKey + ")")
        }
        this.foreignKey = key
    }

    optional(): OptionalRelation<Key, T> {
        return new OptionalRelation(this)
    }
}