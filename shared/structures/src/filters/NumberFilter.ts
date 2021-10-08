
// Date example

import { Data, EncodeContext, NumberDecoder, PlainObject } from "@simonbackx/simple-encoding"

import { Filter, FilterDefinition, FilterDefinitionSettings } from "./FilterDefinition"

export class NumberFilterDefinition<T> extends FilterDefinition<T, NumberFilter<T>, number> {
    floatingPoint = false
    currency = false

    constructor(settings: FilterDefinitionSettings<T, NumberFilter<T>, number> & { floatingPoint?: boolean, currency?: boolean }) {
        super(settings)

        if (settings.floatingPoint !== undefined) {
            this.floatingPoint = settings.floatingPoint
        }

        if (settings.currency !== undefined) {
            this.currency = settings.currency
        }
    }

    decode(data: Data): NumberFilter<T> {
        const filter = this.createFilter()
        filter.start = data.optionalField("start")?.nullable(NumberDecoder) ?? null
        filter.end = data.optionalField("end")?.nullable(NumberDecoder) ?? null
        filter.mode = data.optionalField("mode")?.enum(NumberFilterMode) ?? NumberFilterMode.Equal
        return filter
    }

    createFilter(): NumberFilter<T> {
        const filter = new NumberFilter<T>()
        filter.definition = this
        return filter
    }
}

export enum NumberFilterMode {
    GreaterThan = "GreaterThan",
    LessThan = "LessThan",
    Between = "Between",
    NotBetween = "NotBetween",
    Equal = "Equal",
    NotEqual = "NotEqual"
}

export class NumberFilter<T> extends Filter<T> {
    start: number | null = null
    end: number | null = null
    mode: NumberFilterMode = NumberFilterMode.Equal
    definition: NumberFilterDefinition<T>

    doesMatch(object: T): boolean {
        const num = this.definition.getValue(object)

        if (this.mode === NumberFilterMode.LessThan) {
            if (this.end === null) {
                return true
            }

            return num <= this.end
        }

        if (this.mode === NumberFilterMode.GreaterThan) {
            if (this.start === null) {
                return true
            }

            return num >= this.start
        }

        if (this.mode === NumberFilterMode.Between) {
            if (this.start === null) {
                if (this.end === null) {
                    return true
                }
                return num <= this.end
            }
            
            if (this.end === null) {
                return num >= this.start
            }

            return num >= this.start && num <= this.end
        }

        if (this.mode === NumberFilterMode.NotBetween) {
            if (this.start === null) {
                if (this.end === null) {
                    return false
                }
                return num > this.end
            }
            
            if (this.end === null) {
                return num < this.start
            }

            return !(num >= this.start && num <= this.end)
        }

        if (this.mode === NumberFilterMode.NotEqual) {
            return num !== this.start
        }

        return num === this.start
    }

    encode(context: EncodeContext): PlainObject {
        return {
            definitionId: this.definition.id,
            start: this.start === null ? undefined : this.start,
            end: this.end === null ? undefined : this.end,
            mode: this.mode
        }
    }

    toString() {
        if (this.mode === NumberFilterMode.GreaterThan) {
            return this.definition.name + " is "+this.start+" of meer"
        }

        if (this.mode === NumberFilterMode.LessThan) {
            return this.definition.name + " is "+this.end+" of minder"
        }

        if (this.mode === NumberFilterMode.Between) {
            if (this.start === null) {
                if (this.end === null) {
                    return this.definition.name + " is gelijk wat"
                }
                return this.definition.name + " is "+this.end+" of minder"
            }

            if (this.end === null) {
                return this.definition.name + " is "+this.start+" of meer"
            }

            return this.definition.name + " tussen "+this.start+" en "+this.end
        }
        if (this.mode === NumberFilterMode.NotBetween) {
            if (this.start === null) {
                if (this.end === null) {
                    return "nooit"
                }
                return this.definition.name + " is groter dan "+this.end
            }

            if (this.end === null) {
                return this.definition.name + " is kleiner dan "+this.start
            }

            return this.definition.name + " niet tussen "+this.start+" en "+this.end
        }
        if (this.mode === NumberFilterMode.NotEqual) {
            return this.definition.name + " is niet gelijk aan "+this.start
        }
        if (this.mode === NumberFilterMode.Equal) {
            return this.definition.name + " is gelijk aan "+this.start
        }
        return "Onbekend"
    }
}