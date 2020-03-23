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