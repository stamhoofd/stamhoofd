
import { AnyDecoder, Data, Decoder, Encodeable, EncodeContext, ObjectData, PlainObject, VersionBox, VersionBoxDecoder } from "@simonbackx/simple-encoding";
import { Formatter } from "@stamhoofd/utility";

import { Version } from "../Version";
import { Filter,FilterDecoder, FilterDefinition } from "./FilterDefinition";

/**
 * This is a list of filters, but without the known definitions because we can only decode at a point where the definitions are known.
 * This allows for more recursive structures in filter definitions.
 */
export class FilterGroupEncoded<T> implements Encodeable {
    // Contains an encoded version of a FilterGroup, encoded with version that is stored
    data: PlainObject
    version: number

    constructor(data: PlainObject, version: number) {
        this.data = data
        this.version = version
    }

    decode(definitions: FilterDefinition<T, Filter<T>, any>[]): FilterGroup<T> {
        const decoder = new FilterGroupDecoder(definitions)
        const versionBoxDecoder = new VersionBoxDecoder(decoder)
        return versionBoxDecoder.decode(new ObjectData({
            data: this.data,
            version: this.version
        }, {version: 0})).data
    }

    encode(context: EncodeContext): PlainObject {
        if (context.version < 169) {
            return this.data
        }
        return {
            data: this.data,
            version: this.version
        }
    }

    static encode<T>(filter: FilterGroup<T>): FilterGroupEncoded<T> {
        return new FilterGroupEncoded<T>(filter.encode({ version: Version }), Version)
    }

    static decode<T>(data: Data): FilterGroupEncoded<T> {
        if (data.optionalField("version")) {
            const d = data.field("data").decode(AnyDecoder);
            const version = data.field("version").integer;

            return new FilterGroupEncoded<T>(d as PlainObject, version)
        }

        const d = data.decode(AnyDecoder);
        const version = data.context.version;

        return new FilterGroupEncoded<T>(d as PlainObject, version)
    }
}


export enum GroupFilterMode {
    Or = "Or",
    And = "And",
    /**
     * Means !(A || B) == !A && !B
     */
    Nor = "Nor",
    /**
     * Means !(A && B) == !A || !B
     */
    Nand = "Nand",
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

    get encoded() {
        return FilterGroupEncoded.encode(this)
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

                if (this.mode === GroupFilterMode.Nand) {
                    return true
                }
            } else {
                if (this.mode === GroupFilterMode.Or) {
                    return true
                } 

                if (this.mode === GroupFilterMode.Nor) {
                    return false
                }
            }
        }
        return this.filters.length == 0 || this.mode === GroupFilterMode.And || this.mode === GroupFilterMode.Nor
    }

    encode(context: EncodeContext): PlainObject {
        return {
            filters: this.filters.map(f => f.encode(context)),
            mode: this.mode,
            definitionId: this.definition.id
        }
    }

    get inverted(): FilterGroup<T> {
        const group = this.clone() as FilterGroup<T>
        switch (group.mode) {
            case GroupFilterMode.And:
                group.mode = GroupFilterMode.Nand
                break
            case GroupFilterMode.Nand:
                group.mode = GroupFilterMode.And
                break
            case GroupFilterMode.Or:
                group.mode = GroupFilterMode.Nor
                break
            case GroupFilterMode.Nor:
                group.mode = GroupFilterMode.Or
                break
        }
        return group
    }


    toString() {
        switch(this.mode) {
            case GroupFilterMode.Or:
                return Formatter.joinLast(this.filters.map(f => f.toString()), ", ", " of ")
            case GroupFilterMode.And:
                return Formatter.joinLast(this.filters.map(f => f.toString()), ", ", " en ")
            case GroupFilterMode.Nand:
                return Formatter.joinLast(this.filters.map(f => f.inverted.toString()), ", ", " of ")
            case GroupFilterMode.Nor:
                return Formatter.joinLast(this.filters.map(f => f.inverted.toString()), ", ", " en ")
        }
    }
}

class FailableDecoder<T> implements Decoder<{value?: T, error?: Error}> {
    decoder: Decoder<T>

    constructor(decoder: Decoder<T>) {
        this.decoder = decoder
    }

    decode(data: Data): {value?: T, error?: Error} {
        try {
            return {
                value: this.decoder.decode(data)
            }
        } catch (e) {
            return {
                error: e
            }
        }
    }
}

export class FilterGroupDecoder<T> extends FilterDefinition<T, FilterGroup<T>, any> implements Decoder<FilterGroup<T>> {
    definitions: FilterDefinition<T, Filter<T>, any>[]

    constructor(definitions: FilterDefinition<T, Filter<T>, any>[]) {
        super({
            id: "filter_group",
            name: "Filtergroep",
            description: 'Een groep van filters die je samen als filter kan gebruiken, waardoor je complexe filters kan opstellen (bv. door en/of te combineren).',
            getValue: () => {
                throw new Error("Can't get value of group filter definition")
            }
        })
        this.definitions = definitions
    }
    
    decode(data: Data): FilterGroup<T> {
        const filterDecoder = new FilterDecoder([...this.definitions, this])
        const group = this.createFilter()

        const failableDecoder = new FailableDecoder(filterDecoder)
        const decodedFilters = data.field("filters").array(failableDecoder)
        const errors = decodedFilters.flatMap(f => f.error ? [f.error] : [])
        if (errors.length > 0) {
            console.warn('Failed to decode FilterGroup completely', errors)
        }
        group.filters = decodedFilters.flatMap(f => f.value ? [f.value] : [])
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