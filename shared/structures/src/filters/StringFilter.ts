
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
    NotContains = "NotContains",
    NotEquals = "NotEquals",
    NotEmpty = "NotEmpty",
    Empty = "Empty"
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
        if (this.mode === StringFilterMode.NotEquals) {
            return StringCompare.typoCount(str, this.value) != 0
        }
        if (this.mode === StringFilterMode.NotEmpty) {
            return str != ""
        }
        if (this.mode === StringFilterMode.Empty) {
            return str == ""
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

    toString() {
        if (this.definition.explainFilter) {
            return this.definition.explainFilter(this)
        }
        if (this.mode === StringFilterMode.Contains) {
            return this.definition.name + " bevat "+this.value
        }
        if (this.mode === StringFilterMode.NotContains) {
            return this.definition.name + " bevat niet "+this.value
        }
        if (this.mode === StringFilterMode.Equals) {
            return this.definition.name + " is gelijk aan "+this.value
        }
        if (this.mode === StringFilterMode.NotEquals) {
            return this.definition.name + " is niet gelijk aan "+this.value
        }
        if (this.mode === StringFilterMode.NotEmpty) {
            return this.definition.name + " is niet leeg"
        }
        if (this.mode === StringFilterMode.Empty) {
            return this.definition.name + " is leeg"
        }
        return "Onbekend"
    }
}