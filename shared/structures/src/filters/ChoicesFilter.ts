
// Date example

import { Data, EncodeContext, PlainObject, StringDecoder } from "@simonbackx/simple-encoding"
import { Formatter } from "@stamhoofd/utility"

import { Filter, FilterDefinition, FilterDefinitionSettings } from "./FilterDefinition"
export class ChoicesFilterChoice {
    id: string
    name: string
    description?: string

    constructor(id: string, name: string, description?: string) {
        this.id = id
        this.name = name
        this.description = description
    }
}

export enum ChoicesFilterMode {
    Or = "Or",
    And = "And",
}

export class ChoicesFilterDefinition<T> extends FilterDefinition<T, ChoicesFilter<T>, string[]> {
    choices: ChoicesFilterChoice[] = []
    defaultMode = ChoicesFilterMode.Or

    constructor(settings: FilterDefinitionSettings<T, ChoicesFilter<T>, string[]> & { choices: ChoicesFilterChoice[], defaultMode?: ChoicesFilterMode }) {
        super(settings)
        if (settings.defaultMode) {
            this.defaultMode = settings.defaultMode
        }
        this.choices = settings.choices
    }

    decode(data: Data): ChoicesFilter<T> {
        const filter = new ChoicesFilter<T>()
        filter.definition = this
        filter.choiceIds = data.optionalField("choiceIds")?.array(StringDecoder) ?? []
        filter.mode = data.optionalField("mode")?.enum(ChoicesFilterMode) ?? this.defaultMode
        return filter
    }

    createFilter(): ChoicesFilter<T> {
        const filter = new ChoicesFilter<T>()
        filter.definition = this
        filter.mode = this.defaultMode
        return filter
    }
}

export class ChoicesFilter<T> extends Filter<T> {
    choiceIds: string[] = []
    definition: ChoicesFilterDefinition<T>
    mode = ChoicesFilterMode.Or

    doesMatch(object: T): boolean {
        if (this.choiceIds.length === 0) {
            // Empty filter does not filter
            return true
        }

        const ids = this.definition.getValue(object)

        for (const id of this.choiceIds) {
            if (ids.includes(id)) {
                if (this.mode === ChoicesFilterMode.Or) {
                    return true
                }
            } else {
                if (this.mode === ChoicesFilterMode.And) {
                    return false
                }
            }
        }
        return this.mode === ChoicesFilterMode.And
    }

    encode(context: EncodeContext): PlainObject {
        return {
            definitionId: this.definition.id,
            choiceIds: this.choiceIds,
            mode: this.mode
        }
    }

    toString() {
        if (this.mode === ChoicesFilterMode.Or) {
            return this.definition.name + " is "+Formatter.joinLast(this.choiceIds.map(c => this.definition.choices.find(cc => cc.id == c)?.name ?? c), ", ", " of ")
        } else {
            return this.definition.name + " is "+Formatter.joinLast(this.choiceIds.map(c => this.definition.choices.find(cc => cc.id == c)?.name ?? c), ", ", " en ")
        }
    }
}