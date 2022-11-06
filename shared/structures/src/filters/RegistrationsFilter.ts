
// Date example

import { AutoEncoder, BooleanDecoder, Data, Decoder, EncodeContext, field, PlainObject, StringDecoder } from "@simonbackx/simple-encoding"
import { Formatter } from "@stamhoofd/utility"

import { Organization } from "../Organization"
import { Filter, FilterDefinition } from "./FilterDefinition"


export class RegistrationsFilterChoice extends AutoEncoder {
    /**
     * Contains the group id
     */
    @field({ decoder: StringDecoder })
    id: string

    @field({ decoder: StringDecoder })
    name = ""

    /**
     * Whether registrations on waiting lists count or not (or doesn't matter = null)
     */
    @field({ decoder: BooleanDecoder })
    waitingList = false
}

export enum RegistrationsFilterMode {
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
 * RegistrationsFilter is used because the available groups don't need to be encoded and can change without breaking the encoding/decoding
 */
export class RegistrationsFilterDefinition<T> extends FilterDefinition<T, RegistrationsFilter<T>, RegistrationsFilterChoice[]> {
    getChoices(organization: Organization): RegistrationsFilterChoice[] {
        const choices: RegistrationsFilterChoice[] = []

        for (const group of organization.adminAvailableGroups) {
            choices.push(RegistrationsFilterChoice.create({
                id: group.id,
                waitingList: false,
                name: group.settings.name
            }))
        }
        return choices
    }

    decode(data: Data): RegistrationsFilter<T> {
        const filter = new RegistrationsFilter<T>()
        filter.definition = this
        filter.choices = data.optionalField("choices")?.array(RegistrationsFilterChoice as Decoder<RegistrationsFilterChoice>) ?? []
        filter.mode = data.optionalField("mode")?.enum(RegistrationsFilterMode) ?? RegistrationsFilterMode.Or
        return filter
    }

    createFilter(): RegistrationsFilter<T> {
        const filter = new RegistrationsFilter<T>()
        filter.definition = this
        filter.mode = RegistrationsFilterMode.Or
        return filter
    }
}

export class RegistrationsFilter<T> extends Filter<T> {
    choices: RegistrationsFilterChoice[] = []
    definition: RegistrationsFilterDefinition<T>
    mode = RegistrationsFilterMode.Or

    doesMatch(object: T): boolean {
        if (this.choices.length === 0) {
            // Empty filter does not filter
            return true
        }

        const choices = this.definition.getValue(object)

        for (const choice of this.choices) {
            if (choices.find(c => c.id == choice.id)) {
                if (this.mode === RegistrationsFilterMode.Or) {
                    return true
                }

                if (this.mode === RegistrationsFilterMode.Nor) {
                    return false
                }
            } else {
                if (this.mode === RegistrationsFilterMode.Nand) {
                    return true
                }

                if (this.mode === RegistrationsFilterMode.And) {
                    return false
                }
            }
        }

        return this.mode === RegistrationsFilterMode.And || this.mode === RegistrationsFilterMode.Nor
    }

    encode(context: EncodeContext): PlainObject {
        return {
            definitionId: this.definition.id,
            choices: this.choices.map(c => c.encode(context)),
            mode: this.mode
        }
    }

    toString() {
        switch(this.mode) {
            case RegistrationsFilterMode.Or:
                return "Is ingeschreven voor "+Formatter.joinLast(this.choices.map(c => c.name), ", ", " of ")
            case RegistrationsFilterMode.And:
                return "Is ingeschreven voor zowel "+Formatter.joinLast(this.choices.map(c => c.name), ", ", " als ")
            case RegistrationsFilterMode.Nand:
                return Formatter.capitalizeFirstLetter(Formatter.joinLast(this.choices.map(c => 'niet ingeschreven voor ' + c.name), ", ", " of "))
            case RegistrationsFilterMode.Nor:
                return Formatter.capitalizeFirstLetter(Formatter.joinLast(this.choices.map(c => 'niet ingeschreven voor ' + c.name), ", ", " en "))
        }
    }
}