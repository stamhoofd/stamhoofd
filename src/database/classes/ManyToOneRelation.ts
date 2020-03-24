import { Model } from './Model'

export class ManyToOneRelation {
    model: typeof Model

    /**
     * E.g. addressId
     */
    foreignKey: string

    /**
     * E.g. address
     */
    modelKey: string

    constructor(model: typeof Model, modelKey: string) {
        this.model = model
        this.modelKey = modelKey
    }

    /// Whether this relation is loaded
    isLoaded(model: Model): boolean {
        return model[this.modelKey] !== undefined
    }
}