import { Model } from './Model'
import { Query } from './Query'
import { ArrayDecoder } from '../../classes/decoding/ArrayDecoder'

export type RelationLoaded<T extends Relation<string, any, any>> = T extends Relation<infer Key, any, infer B> ? Record<Key, B> : never
/**
 * Specify non null relation
 */
export type RelationSet<T extends Relation<string, any, any>> = T extends Relation<infer Key, any, infer B> ? Record<Key, NonNullable<B>> : never

export interface Relation<Key extends string, A, B> {
    /** key where the relation is saved */
    modelKey: Key;

    query(model: A & Model): Query<B>;
    prepare?(target: any, key);
}

export function isToOneRelation<Key extends string, A, B>(relation: Relation<Key, A, B>): relation is ToOneRelation<Key, A, B> {
    const a = relation as any
    return a.foreignKey && a.fromRow && a.getJoin
}

export function isToManyRelation<Key extends string, A, B>(relation: Relation<Key, A, B>): relation is ToManyRelation<Key, A, B> {
    const a = relation as any
    return a.fetch
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ToManyRelation<Key extends string, A, B> extends Relation<Key, A, B> {
    // todo
}


export interface ToOneRelation<Key extends string, A, B> extends Relation<Key, A, B> {
    /**
     * The column in the table that points to the ID of the foreign table
     */
    foreignKey: string;
    fromRow(row: any): B;
    getJoin(): string;
}
