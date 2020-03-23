import { Model } from './Model'

export class ToOneRelation<Key extends string, T extends typeof Model> {
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
}