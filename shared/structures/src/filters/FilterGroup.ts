
import { Data, Decoder, EncodeContext, PlainObject } from "@simonbackx/simple-encoding";

import { Filter,FilterDecoder, FilterDefinition } from "./FilterDefinition";

/**
 * A filter is an encodebale structure, that is associated with a specific definition
 */

export class FilterGroup<T> extends Filter<T> {
    definition: FilterGroupDecoder<T>
    private definitions: FilterDefinition<T, Filter<T>, any>[]
    filters: Filter<T>[] = []

    constructor(definitions: FilterDefinition<T, Filter<T>, any>[]) {
        super()
        this.definitions = definitions
        this.definition = new FilterGroupDecoder(this.definitions)
    }

    setDefinitions(definitions: FilterDefinition<T, Filter<T>, any>[]) {
        this.definitions = definitions

        // Make sure that decoding is also updated
        this.definition.definitions = this.definitions
    }

    doesMatch(object: T): boolean {
        for (const filter of this.filters) {
            if (!filter.doesMatch(object)) {
                return false
            }
        }
        return true
    }

    encode(context: EncodeContext): PlainObject {
        return {
            filters: this.filters.map(f => f.encode(context)),
            definitionId: "FilterGroup"
        }
    }
}

export class FilterGroupDecoder<T> extends FilterDefinition<T, FilterGroup<T>, any> implements Decoder<FilterGroup<T>> {
    definitions: FilterDefinition<T, Filter<T>, any>[]

    constructor(definitions: FilterDefinition<T, Filter<T>, any>[]) {
        super({
            id: "filter_group",
            name: "Filter group",
            getValue: () => {
                throw new Error("Can't get value of group filter definition")
            }
        })
        this.definitions = definitions
    }
    
    decode(data: Data): FilterGroup<T> {
        const filterDecoder = new FilterDecoder(this.definitions)
        const filters = data.field("filters").array(filterDecoder)

        const group = this.createFilter()
        group.filters = filters
        return group
    }

    createFilter(): FilterGroup<T> {
        return new FilterGroup<T>(this.definitions)
    }
}

/**
 * The decoder is also the definition of a group filter (since it contains alle the available definitions needed for decoding)
 */
export type FilterGroupDefinition<T> = FilterGroupDecoder<T>