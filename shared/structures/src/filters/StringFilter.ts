
// Date example

import { Data, EncodeContext, PlainObject } from "@simonbackx/simple-encoding"
import { StringCompare } from "@stamhoofd/utility"

import { Filter, FilterDefinition } from "./FilterDefinition"

export class StringFilterDefinition<T> extends FilterDefinition<T, StringFilter<T>, string> {
    decode(data: Data): StringFilter<T> {
        const filter = new StringFilter()
        filter.definition = this
        filter.value = data.optionalField("value")?.string ?? ""
        filter.mode = data.optionalField("mode")?.enum(StringFilterMode) ?? StringFilterMode.Contains
        return filter
    }

    createFilter(): StringFilter<T> {
        const filter = new StringFilter<T>()
        filter.definition = this
        return filter
    }
}

export enum StringFilterMode {
    Contains = "Contains",
    Equals = "Equals",
    NotContains = "NotContains"
}

export class StringFilter<T> extends Filter<T> {
    value = ""
    mode: StringFilterMode = StringFilterMode.Contains
    definition: StringFilterDefinition<T>

    doesMatch(object: T): boolean {
        const str = this.definition.getValue(object)
        if (this.mode === StringFilterMode.Contains) {
            return StringCompare.contains(str, this.value)
        }
        if (this.mode === StringFilterMode.NotContains) {
            return !StringCompare.contains(str, this.value)
        }
        if (this.mode === StringFilterMode.Equals) {
            return StringCompare.typoCount(str, this.value) == 0
        }
        return false
    }

    encode(context: EncodeContext): PlainObject {
        return {
            definitionId: this.definition.id,
            value: this.value,
            mode: this.mode
        }
    }
}