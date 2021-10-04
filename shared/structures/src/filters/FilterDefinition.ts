import { Data, DateDecoder, Decoder, Encodeable, EncodeContext, ObjectData, PlainObject } from "@simonbackx/simple-encoding"
import { SimpleError } from "@simonbackx/simple-errors";

/**
 * Helper types
 */

export type RecursivePartial<T> = {
    [P in keyof T]?:
    T[P] extends Array<infer U> ? Array<Value<U>> : Value<T[P]>;
};
type AllowedPrimitives = boolean | string | number | Date /* add any types than should be considered as a value, say, DateTimeOffset */;
type Value<T> = T extends AllowedPrimitives ? T : RecursivePartial<T>;

/**
 * Points to a value in a object of type T that is filterable
 */
export abstract class FilterDefinition<T, FilterType extends Filter<T>> implements Decoder<FilterType>{
    id: string
    name: string
    getValue: (object: RecursivePartial<T>) => any

    constructor(id: string, name: string) {
        this.id = id
        this.name = name
    }

    abstract decode(data: Data): FilterType
    abstract createFilter(): FilterType
}

/*export class FilterStringDefinition<T> extends FilterDefinition<T> {
    getValue: (object: RecursivePartial<T>) => string
}
*/


/**
 * A filter is an encodebale structure, that is associated with a specific definition
 */

export abstract class Filter<T> implements Encodeable {
    definition: FilterDefinition<T, Filter<T>>

    abstract doesMatch(object: T): boolean
    abstract encode(context: EncodeContext): PlainObject

    clone(): Filter<T> {
        const o = new ObjectData(this.encode({ version: 0 }), { version: 0})
        return this.definition.decode(o)
    }
}

export class FilterDecoder<T> implements Decoder<Filter<T>> {
    definitions: FilterDefinition<T, Filter<T>>[]

    constructor(definitions: FilterDefinition<T, Filter<T>>[]) {
        this.definitions = definitions
    }
    
    decode(data: Data): Filter<T> {
        const definitionId = data.field("definitionId").string
        const definition = this.definitions.find(d => d.id === definitionId) 
        if (!definition) {
            throw new SimpleError({
                code: "invalid_definition",
                message: "De opgeslagen filter filtert op iets dat niet langer bestaat",
                field: data.addToCurrentField("definitionId")
            })
        }
        return definition.decode(data)
    }
}