import { PlainObject } from "@simonbackx/simple-encoding"
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation"

export interface FilterUIBuilderDefinition<Builder extends FilterUIBuilder = FilterUIBuilder> {
    create(): Builder
}

export interface FilterUIBuilder {
    build(): PlainObject
    getComponent(): ComponentWithProperties
    get description(): string
}
