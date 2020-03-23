// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Model } from './Model'
import { Relation, ToManyRelation } from './Relation'
import { Query, RowInitiable } from './Query'
import { ManyToOneRelation } from './ManyToOneRelation'

class LinkTable {
    static fromRow(row: any): LinkTable {
        return {}
    }
}

export class ManyToManyRelation<Key extends string, A extends Model, B extends Model> implements ToManyRelation<Key, A, B> {
    /** key where the relation is saved */
    modelKey: Key

    /** Model of the referenced table */
    modelA: A
    modelB: B

    linkTable: string

    constructor(modelA: A, modelB: B, modelKey: Key, linkTable: string) {
        this.modelA = modelA
        this.modelB = modelB
        this.modelKey = modelKey
        this.linkTable = linkTable
    }

    query(model: A & Model): Query<B> {
        const foreignKey = this.modelB.static.table + "_" + this.modelB.static.primaryKey;

        const query = new Query("select", this.linkTable, LinkTable as RowInitiable<LinkTable>).with(new ManyToOneRelation<"loaded", LinkTable, B>(new LinkTable(), this.modelB, "loaded", foreignKey))
        query.where({ key: this.modelA.static.table + "_" + this.modelA.static.primaryKey, value: model.getPrimaryKey() });

        return query

        return result.map(e => e["loaded"])
    }
}