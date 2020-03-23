import { Model } from './Model'

export class ToOneRelation {
    /** The key where the referenced primary key is saved */
    foreignKey: string

    /** key where the relation is saved */
    modelKey: string

    /** Model of the referenced table */
    model: typeof Model

}