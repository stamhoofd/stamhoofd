
import { PatchableArrayDecoder } from "@simonbackx/simple-encoding"
import { ArrayDecoder } from "@simonbackx/simple-encoding"
import { Data, Decoder, Encodeable, EncodeContext, ObjectData, PlainObject } from "@simonbackx/simple-encoding"

import { Filter, FilterDefinition } from "./FilterDefinition"
import { FilterGroup, FilterGroupDecoder } from "./FilterGroup"

export class PropertyFilter<T> implements Encodeable {
    constructor(enabledWhen: FilterGroup<T>, requiredWhen: FilterGroup<T> | null) {
        this.enabledWhen = enabledWhen
        this.requiredWhen = requiredWhen
    }

    static createDefault<T>(definitions: FilterDefinition<T, Filter<T>, any>[]) {
        return new PropertyFilter<T>(new FilterGroup(definitions), new FilterGroup(definitions))
    }

    get definitions() {
        return this.enabledWhen.getDefinitions()
    }

    /**
     * Enabled when...
     * cannot be null (always should be enabled)
     */
    enabledWhen: FilterGroup<T>

    /**
     * If enabled, whether it is required
     */
    requiredWhen: FilterGroup<T> | null = null

    toString() {
        if (this.enabledWhen.filters.length == 0) {
            // Always enabled

            if (this.requiredWhen === null) {
                return "Optioneel invullen"
            }
            if (this.requiredWhen.filters.length == 0) {
                return "Verplicht invullen"
            }

            return "Verplicht invullen als: "+this.requiredWhen.toString()
        }

        if (this.requiredWhen === null) {
            return "Ingeschakeld, en altijd optioneel als: "+this.enabledWhen.toString()
        }

        if (this.requiredWhen.filters.length == 0) {
            return "Ingeschakeld als: "+this.enabledWhen.toString()
        }

        return "Ingeschakeld als: "+this.enabledWhen+", enkel verplicht invullen als: "+this.requiredWhen.toString()
    }

    encode(context: EncodeContext): PlainObject {
        return {
            enabledWhen: this.enabledWhen.encode(context),
            requiredWhen: this.requiredWhen === null ? null : this.requiredWhen.encode(context)
        }
    }
}

export class PropertyFilterDecoder<T> implements Decoder<PropertyFilter<T>> {
    definitions: FilterDefinition<T, Filter<T>, any>[]

    constructor(definitions: FilterDefinition<T, Filter<T>, any>[]) {
        this.definitions = definitions
    }

    decode(data: Data): PropertyFilter<T> {
        const decoder = new FilterGroupDecoder<T>(this.definitions)

        return new PropertyFilter<T>(
            data.field("enabledWhen").decode(decoder),
            data.field("requiredWhen").nullable(decoder)
        )
    }
}

/**
 * Set the decoder in the current context that are needed for the PropertyFilterDecoderFromContext
 * -> reason: some generic object needs definitions, but those defintions depend on the context (it allows other filters depending on the usage)
 */
export class SetPropertyFilterDecoder<T> implements Decoder<T> {
    decoder: Decoder<T>
    definitions: FilterDefinition<any, any, any>[]

    constructor(decoder: Decoder<T>, definitions: FilterDefinition<any, any, any>[]) {
        this.decoder = decoder
        this.definitions = definitions
    }

    decode(data: Data): T {
        const updatedData = new ObjectData(data.value, {...data.context, definitions: this.definitions } as any, data.currentField);
        return updatedData.decode(this.decoder)
    }

    patchType() {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (!(this.decoder as any).patchType) {
            return this.decoder
        }
        const patchDecoder = (this.decoder as any).patchType()
        return new SetPropertyFilterDecoder(patchDecoder, this.definitions)
    }

    patchDefaultValue() {
        if (!(this.decoder as any).patchDefaultValue) {
            return undefined
        }

        return (this.decoder as any).patchDefaultValue()
    }

}

export class PropertyFilterDecoderFromContext implements Decoder<PropertyFilter<any>> {

    decode(data: Data): PropertyFilter<any> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        let definitions: any[] = ((data.context as any)["definitions"]) ?? []
        

        if (definitions.length > 0 && !(definitions[0] instanceof FilterDefinition)) {
            definitions = []
            console.warn("Failed to read filter definitions from context while decoding", definitions)
        }

        return new PropertyFilterDecoder(definitions).decode(data)
    }

}