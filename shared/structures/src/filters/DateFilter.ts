
// Date example

import { Data, DateDecoder, EncodeContext, PlainObject } from "@simonbackx/simple-encoding"
import { Formatter } from "@stamhoofd/utility"

import { Filter, FilterDefinition, FilterDefinitionSettings } from "./FilterDefinition"

/** 
 * @Example Create a date filter for orders
 * ```ts
 *  const OrderDateDefinition = new FilterDateDefinition<Order>("orderDate", "Besteldatum", (order) => order?.createdAt ?? new Date() )
 * const exampleFilter = new DateFilter<Order>()
 * exampleFilter.definition = OrderDateDefinition
 * exampleFilter.minimumDate = new Date(2020, 0, 1)
 * ```
*/
export class DateFilterDefinition<T> extends FilterDefinition<T, DateFilter<T>, Date> {
    /**
     * Also filter on time
     */
    time = true

    constructor(settings: FilterDefinitionSettings<T, DateFilter<T>, Date> & { time?: boolean }) {
        super(settings)

        if (settings.time !== undefined) {
            this.time = settings.time
        }
    }

    decode(data: Data): DateFilter<T> {
        const filter = new DateFilter()
        filter.definition = this

        // TODO
        filter.mode = data.optionalField("mode")?.enum(DateFilterMode) ?? DateFilterMode.Equal
        filter.minimumDate = data.optionalField("minimumDate")?.decode(DateDecoder)
        filter.maximumDate = data.optionalField("maximumDate")?.decode(DateDecoder)

        return filter
    }

    createFilter(): DateFilter<T> {
        const filter = new DateFilter<T>()
        filter.definition = this
        return filter
    }
}

export enum DateFilterMode {
    GreaterThan = "GreaterThan",
    LessThan = "LessThan",
    Between = "Between",
    NotBetween = "NotBetween",
    Equal = "Equal",
    NotEqual = "NotEqual"
}


export class DateFilter<T> extends Filter<T> {
    minimumDate?: Date
    maximumDate?: Date
    mode: DateFilterMode = DateFilterMode.Equal
    definition: DateFilterDefinition<T>

    doesMatch(object: T): boolean {
        const date = new Date(this.definition.getValue(object))

        if (!this.definition.time) {
            date.setHours(0, 0, 0, 0)
        } else {
            date.setSeconds(0, 0)
        }

        if (this.mode === DateFilterMode.Between) {
            if (this.minimumDate) {
                if (date < this.minimumDate) {
                    return false
                }
            }
            if (this.maximumDate) {
                if (date > this.maximumDate) {
                    return false
                }
            }
        }

        if (this.mode === DateFilterMode.NotBetween) {
            if (this.minimumDate) {
                if (date < this.minimumDate) {
                    return true
                }
            }
            if (this.maximumDate) {
                if (date > this.maximumDate) {
                    return true
                }
            }
            return false
        }

        if (this.mode === DateFilterMode.GreaterThan) {
            if (this.minimumDate) {
                if (date >= this.minimumDate) {
                    return true
                }
            }
            return false
        }

        if (this.mode === DateFilterMode.LessThan) {
            if (this.maximumDate) {
                if (date <= this.maximumDate) {
                    return true
                }
            }
            return false
        }

        if (this.mode === DateFilterMode.Equal) {
            if (this.minimumDate) {
                if (date.getTime() === this.minimumDate.getTime()) {
                    return true
                }
            }
            return false
        }

        if (this.mode === DateFilterMode.NotEqual) {
            if (this.minimumDate) {
                if (date.getTime() === this.minimumDate.getTime()) {
                    return false
                }
            }
            return true
        }

        return true
    }

    encode(context: EncodeContext): PlainObject {
        return {
            definitionId: this.definition.id,
            mode: this.mode,
            minimumDate: this.minimumDate?.getTime(),
            maximumDate: this.maximumDate?.getTime(),
        }
    }

    toString() {
        if (this.definition.explainFilter) {
            return this.definition.explainFilter(this)
        }
        
        const start = this.minimumDate ? (this.definition.time ? Formatter.dateTime(this.minimumDate) : Formatter.date(this.minimumDate)) : "?"
        const end = this.maximumDate ? (this.definition.time ? Formatter.dateTime(this.maximumDate) : Formatter.date(this.maximumDate)) : "?"

        if (this.mode === DateFilterMode.GreaterThan) {
            return this.definition.name + " is op of na "+start
        }

        if (this.mode === DateFilterMode.LessThan) {
            return this.definition.name + " is "+end+" of minder"
        }

        if (this.mode === DateFilterMode.Between) {
            return this.definition.name + " tussen "+start+" en "+end
        }
        if (this.mode === DateFilterMode.NotBetween) {
            return this.definition.name + " niet tussen "+start+" en "+end
        }
        if (this.mode === DateFilterMode.NotEqual) {
            return this.definition.name + " is niet gelijk aan "+start
        }
        if (this.mode === DateFilterMode.Equal) {
            return this.definition.name + " is gelijk aan "+start
        }
        return "Onbekend"
    }
}