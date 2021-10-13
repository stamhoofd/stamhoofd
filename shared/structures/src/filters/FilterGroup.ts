
import { Data, Decoder, EncodeContext, PlainObject } from "@simonbackx/simple-encoding";
import { Formatter } from "@stamhoofd/utility";

import { Filter,FilterDecoder, FilterDefinition } from "./FilterDefinition";


export enum GroupFilterMode {
    Or = "Or",
    And = "And",
}

/**
 * A filter is an encodebale structure, that is associated with a specific definition
 */

export class FilterGroup<T> extends Filter<T> {
    definition: FilterGroupDecoder<T>
    private definitions: FilterDefinition<T, Filter<T>, any>[]
    filters: Filter<T>[] = []
    mode = GroupFilterMode.And

    constructor(definitions: FilterDefinition<T, Filter<T>, any>[], filters: Filter<T>[] = [], mode = GroupFilterMode.And) {
        super()
        this.definitions = definitions
        this.filters = filters
        this.definition = new FilterGroupDecoder(this.definitions)
        this.mode = mode
    }

    setDefinitions(definitions: FilterDefinition<T, Filter<T>, any>[]) {
        this.definitions = definitions

        // Make sure that decoding is also updated
        this.definition.definitions = this.definitions
    }

    getDefinitions() {
        return this.definitions
    }

    doesMatch(object: T): boolean {
        for (const filter of this.filters) {
            if (!filter.doesMatch(object)) {
                if (this.mode === GroupFilterMode.And) {
                    return false
                }
            } else {
                if (this.mode === GroupFilterMode.Or) {
                    return true
                } 
            }
        }
        return this.filters.length == 0 || this.mode === GroupFilterMode.And
    }

    encode(context: EncodeContext): PlainObject {
        return {
            filters: this.filters.map(f => f.encode(context)),
            definitionId: "FilterGroup"
        }
    }

    toString() {
        if (this.mode === GroupFilterMode.And) {
            return Formatter.joinLast(this.filters.map(f => f.toString()), ", ", " en ")
        }
        return Formatter.joinLast(this.filters.map(f => f.toString()), ", ", " of ")
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
        const group = this.createFilter()
        group.filters = data.field("filters").array(filterDecoder)
        group.mode = data.optionalField("mode")?.enum(GroupFilterMode) ?? GroupFilterMode.And
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