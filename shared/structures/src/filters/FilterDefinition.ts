import { Data, DateDecoder, Decoder, Encodeable, EncodeContext, ObjectData, PlainObject } from "@simonbackx/simple-encoding"
import { SimpleError } from "@simonbackx/simple-errors";


export type FilterDefinitionSettings<T, FilterType extends Filter<T>, ValueType> = { 
    id: string, 
    name: string, 
    description?: string,
    getValue: (object: T) => ValueType, 
    explainFilter?: (filter: FilterType) => string,
    category?: string
}
/**
 * Points to a value in a object of type T that is filterable
 */
export abstract class FilterDefinition<T = any, FilterType extends Filter<T> = Filter<T>, ValueType = any> implements Decoder<FilterType>{
    id: string
    name: string
    description?: string

    // for grouping
    category?: string

    getValue: (object: T) => ValueType

    /**
     * Transform a filter in an explanation text (optional)
     */
    explainFilter?: (filter: FilterType) => string

    constructor(settings: FilterDefinitionSettings<T, FilterType, ValueType>) {
        this.id = settings.id
        this.name = settings.name
        this.category = settings.category
        this.description = settings.description
        this.getValue = settings.getValue
        this.explainFilter = settings.explainFilter
    }

    abstract decode(data: Data): FilterType
    abstract createFilter(): FilterType
}

/**
 * A filter is an encodebale structure, that is associated with a specific definition
 */

export abstract class Filter<T> implements Encodeable {
    definition: FilterDefinition<T, Filter<T>, any>

    abstract doesMatch(object: T): boolean
    abstract encode(context: EncodeContext): PlainObject
    abstract get inverted(): Filter<T>

    clone(): Filter<T> {
        const o = new ObjectData(this.encode({ version: 0 }), { version: 0})
        return this.definition.decode(o)
    }
}

export class FilterDecoder<T> implements Decoder<Filter<T>> {
    definitions: FilterDefinition<T, Filter<T>, any>[]

    constructor(definitions: FilterDefinition<T, Filter<T>, any>[]) {
        this.definitions = definitions
    }
    
    decode(data: Data): Filter<T> {
        const definitionId = data.field("definitionId").string
        const definition = this.definitions.find(d => d.id === definitionId) 
        if (!definition) {
            throw new SimpleError({
                code: "invalid_definition",
                message: "De opgeslagen filter filtert op iets dat niet langer bestaat: "+definitionId,
                field: data.addToCurrentField("definitionId")
            })
        }
        return definition.decode(data)
    }
}

/**
 * Allow filters that are extendable on definitions that are saved in the contextx
 */
export class ExtendableFilterDecoder<T> implements Decoder<Filter<T>> {
    definitions: FilterDefinition<T, Filter<T>, any>[]

    constructor(definitions: FilterDefinition<T, Filter<T>, any>[]) {
        this.definitions = definitions
    }
    
    decode(data: Data): Filter<T> {
        const general: EncodeContext & { definitions?: FilterDefinition<T, Filter<T>, any>[]} = data.context
        const extendedDefinitions = general.definitions ?? []
        return new FilterDecoder([...this.definitions, ...extendedDefinitions]).decode(data)
    }

    static saveDefinitionInContext(context: EncodeContext, definition: FilterDefinition<any, Filter<any>, any>) {
        const general: EncodeContext & { definitions?: FilterDefinition<any, Filter<any>, any>[]} = context
        if (!general.definitions) {
            general.definitions = []
        }
        general.definitions.push(definition)
    }
}