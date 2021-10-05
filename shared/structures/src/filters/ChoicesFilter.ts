
// Date example

import { Data, EncodeContext, PlainObject, StringDecoder } from "@simonbackx/simple-encoding"

import { Filter, FilterDefinition } from "./FilterDefinition"
export class ChoicesFilterChoice {
    id: string
    name: string

    constructor(id: string, name: string) {
        this.id = id
        this.name = name
    }
}

export class ChoicesFilterDefinition<T> extends FilterDefinition<T, ChoicesFilter<T>> {
    getValue: (object: T) => string[]

    choices: ChoicesFilterChoice[] = []

    constructor(id: string, name: string, choices: ChoicesFilterChoice[], getValue: (object: T) => string[]) {
        super(id, name)
        this.choices = choices
        this.getValue = getValue
    }

    decode(data: Data): ChoicesFilter<T> {
        const filter = new ChoicesFilter<T>()
        filter.definition = this
        filter.choiceIds = data.optionalField("choiceIds")?.array(StringDecoder) ?? []
        return filter
    }

    createFilter(): ChoicesFilter<T> {
        const filter = new ChoicesFilter<T>()
        filter.definition = this
        return filter
    }
}

export class ChoicesFilter<T> extends Filter<T> {
    choiceIds: string[] = []
    definition: ChoicesFilterDefinition<T>

    doesMatch(object: T): boolean {
        if (this.choiceIds.length === 0) {
            // Empty filter does not filter
            return true
        }

        const ids = this.definition.getValue(object)

        for (const id of ids) {
            if (this.choiceIds.includes(id)) {
                return true
            }
        }
        return false
    }

    encode(context: EncodeContext): PlainObject {
        return {
            definitionId: this.definition.id,
            choiceIds: this.choiceIds,
        }
    }
}