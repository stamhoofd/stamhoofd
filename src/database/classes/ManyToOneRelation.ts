// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Model } from './Model'
import { RelationWithForeignKey } from './Relation'
import { OptionalRelation } from './OptionalRelation'


export class ManyToOneRelation<Key extends string, T extends typeof Model> implements RelationWithForeignKey<Key, InstanceType<T>> {
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