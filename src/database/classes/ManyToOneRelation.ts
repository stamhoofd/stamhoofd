// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Model } from './Model'
import { ToOneRelation } from './Relation'
import { OptionalRelation } from './OptionalRelation'
import { Query, RowInitiable } from './Query'


export class ManyToOneRelation<Key extends string, A, B extends Model> implements ToOneRelation<Key, A, B> {
    /** The key where the referenced primary key is saved */
    foreignKey: string

    /** key where the relation is saved */
    modelKey: Key

    /** Model of the referenced table */
    modelA: A
    modelB: B

    constructor(modelA: A, modelB: B, modelKey: Key, foreignKey?: string) {
        this.modelA = modelA
        this.modelB = modelB
        this.modelKey = modelKey
        if (foreignKey) {
            this.foreignKey = foreignKey
        }
    }

    query(model: A & Model): Query<B> {
        throw new Error("Method not implemented.")
    }

    fromRow(row: any): B {
        const copy = Object.assign({}, this.modelB) as B;
        if (row[this.modelKey][this.modelB.static.primaryKey] !== null) {
            return copy.fromRow(row[this.modelKey])
        }
        throw new Error("Expected relation to be loaded");
    }

    getJoin(): string {
        if (this.foreignKey === undefined) {
            throw new Error("ToOneRelation " + this.modelKey + " has no foreign key set. Please make sure you added a @column which references this relation!")
        }

        return `JOIN \`${this.modelB.static.table}\` as \`${this.modelKey}\` ON \`${this.modelKey}\`.\`${this.modelB.static.primaryKey}\` = \`this\`.\`${this.foreignKey}\``;
    }

    prepare?(target: any, key) {
        console.log("Perpare called");
        if (this.foreignKey && this.foreignKey != key) {
            throw new Error("Cannot set same relation for different foreign key (while setting relation of key " + this.foreignKey + ")")
        }
        this.foreignKey = key
    }

    optional(): OptionalRelation<Key, A, B> {
        return new OptionalRelation(this)
    }
}