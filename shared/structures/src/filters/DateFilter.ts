
// Date example

import { Data, DateDecoder, EncodeContext, PlainObject } from "@simonbackx/simple-encoding"

import { Filter, FilterDefinition, RecursivePartial } from "./FilterDefinition"

/** 
 * @Example Create a date filter for orders
 * ```ts
 *  const OrderDateDefinition = new FilterDateDefinition<Order>("orderDate", "Besteldatum", (order) => order?.createdAt ?? new Date() )
 * const exampleFilter = new DateFilter<Order>()
 * exampleFilter.definition = OrderDateDefinition
 * exampleFilter.minimumDate = new Date(2020, 0, 1)
 * ```
*/
export class FilterDateDefinition<T> extends FilterDefinition<T, DateFilter<T>> {
    /**
     * Also filter on time
     */
    time = true

    getValue: (object: RecursivePartial<T>) => Date

    constructor(id: string, name: string, getValue: (object: RecursivePartial<T>) => Date) {
        super(id, name)
        this.getValue = getValue
    }

    decode(data: Data): DateFilter<T> {
        const filter = new DateFilter()
        filter.definition = this

        // todo
        filter.minimumDate = data.optionalField("minimumDate")?.decode(DateDecoder)

        return filter
    }

    createFilter(): DateFilter<T> {
        const filter = new DateFilter<T>()
        filter.definition = this
        return filter
    }
}

export class DateFilter<T> extends Filter<T> {
    minimumDate?: Date
    maximumDate?: Date
    definition: FilterDateDefinition<T>

    doesMatch(object: T): boolean {
        const date = this.definition.getValue(object)
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
        return true
    }

    encode(context: EncodeContext): PlainObject {
        return {
            definitionId: this.definition.id,
            minimumDate: this.minimumDate?.getTime(),
            maximumDate: this.maximumDate?.getTime(),
        }
    }
}
/*
import { Order } from "../..";


// All orders after 2020
const exampleFilter = new DateFilter<Order>()
exampleFilter.definition = OrderDateDefinition
exampleFilter.minimumDate = new Date(2020, 0, 1)

const encoded = exampleFilter.encode({ version: 0 })


const decoded = new FilterDecoder([OrderDateDefinition]).decode(new ObjectData(encoded, { version: 0 }))
*/