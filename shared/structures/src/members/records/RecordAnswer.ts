import { ArrayDecoder, AutoEncoder, BooleanDecoder, Data, DateDecoder, Decoder,field, StringDecoder } from "@simonbackx/simple-encoding"
import { SimpleError } from "@simonbackx/simple-errors";
import { Formatter } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";

import { Address } from "../../addresses/Address";
import { RecordChoice, RecordSettings,RecordType, RecordWarning } from "./RecordSettings"


export class RecordAnswer extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    /**
     * Settings of this record at the time of input. Depending on the changes, we can auto migrate some settings
     */
    @field({ decoder: RecordSettings })
    settings: RecordSettings

    /**
     * Date that this was changed. To determine merge order
     */
    @field({ decoder: DateDecoder, version: 128 })
    date: Date = new Date()

    /**
     * Date that this answer was last reviewed by the author
     * -> when editing by the organization, don't set this date
     */
    @field({ decoder: DateDecoder, nullable: true })
    reviewedAt: Date | null = null

    isOutdated(timeoutMs: number): boolean {
        if (!this.reviewedAt) {
            return true
        }
        if (this.reviewedAt.getTime() < new Date().getTime() - timeoutMs) {
            return true
        }
        return false
    }

    markReviewed() {
        this.reviewedAt = new Date()
    }

    get stringValue() {
        return "Onbekend"
    }

    /**
     * Include both the setting and the value
     */
    get descriptionValue() {
        return this.settings.name+": "+this.stringValue
    }

    get excelValue() {
        return {
            value: this.stringValue,
            format: null
        }
    }

    getWarnings(): RecordWarning[] {
        return []
    }

    validate() {
        // valid by default
    }

    /**
     * Return true when it is not the default value as a general rule
     * E.g. checkbox by default not checked -> empty if not checked
     */
    get isEmpty() {
        return false
    }
}

export class RecordAnswerDecoderStatic implements Decoder<RecordAnswer> {
    decode(data: Data): RecordAnswer {
        const type = data.field("settings").field("type").enum(RecordType)
        return data.decode(this.getClassForType(type) as Decoder<RecordAnswer>)
    }

    getClassForType(type: RecordType): typeof RecordAnswer {
        switch (type) {
            case RecordType.Checkbox: return RecordCheckboxAnswer
            case RecordType.Text: 
            case RecordType.Phone: 
            case RecordType.Email: 
            case RecordType.Textarea:
                return RecordTextAnswer
            case RecordType.MultipleChoice: return RecordMultipleChoiceAnswer
            case RecordType.ChooseOne: return RecordChooseOneAnswer
            case RecordType.Address: return RecordAddressAnswer
            case RecordType.Date: return RecordDateAnswer
        }
        throw new SimpleError({
            code: "not_supported",
            message: "A property type is not supported",
            human: "Een bepaald kenmerk wordt niet ondersteund. Kijk na of je wel de laatste versie gebruikt en update indien nodig."
        })
    }
}
export const RecordAnswerDecoder = new RecordAnswerDecoderStatic()

export class RecordTextAnswer extends RecordAnswer {
    @field({ decoder: StringDecoder, nullable: true })
    value: string | null = null

    get stringValue() {
        return this.value ?? "/"
    }

    getWarnings(): RecordWarning[] {
        if (!this.settings.warning) {
            return []
        }
        if (this.settings.warning.inverted) {
            return this.value === null || this.value.length == 0 ? [this.settings.warning] : []
        }
        return this.value !== null && this.value.length > 0 ? [this.settings.warning] : []
    }

    override validate() {
        if (this.settings.required && (this.value === null || this.value.length == 0)) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Dit veld is verplicht",
                field: "input"
            })
        }
    }

    get isEmpty() {
        return (this.value === null || this.value.length === 0)
    }
}

export class RecordCheckboxAnswer extends RecordAnswer {
    @field({ decoder: BooleanDecoder })
    selected = false

    @field({ decoder: StringDecoder, optional: true })
    comments?: string

    getWarnings(): RecordWarning[] {
        if (!this.settings.warning) {
            return []
        }
        if (this.settings.warning.inverted) {
            return !this.selected ? [this.settings.warning] : []
        }
        return this.selected ? [this.settings.warning] : []
    }

    get stringValue() {
        return this.selected ? "Aangevinkt" : "Niet aangevinkt"
    }

    get excelValue() {
        return {
            value: this.selected ? (this.comments ? this.comments : "Ja") : "Nee",
            format: null
        }
    }

    override validate() {
        if (this.settings.required && !this.selected) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Dit is verplicht",
                field: "input"
            })
        }
    }

    get isEmpty() {
        return !this.selected
    }
}

export class RecordMultipleChoiceAnswer extends RecordAnswer {
    @field({ decoder: new ArrayDecoder(RecordChoice) })
    selectedChoices: RecordChoice[] = []

    get stringValue() {
        return this.selectedChoices.map(c => c.name).join(", ")
    }

    getWarnings(): RecordWarning[] {
        if (this.selectedChoices.length == 0) {
            return []
        }

        const warnings: RecordWarning[] = []

        for (const choice of this.selectedChoices) {
            if (choice.warning && !choice.warning.inverted) {
                warnings.push(choice.warning)
            }
        }

        for (const choice of this.settings.choices) {
            if (choice.warning && choice.warning.inverted) {
                if (!this.selectedChoices.find(s => s.id === choice.id)) {
                    warnings.push(choice.warning)
                }
            }
        }

        return warnings
    }

    override validate() {
        if (this.settings.required && this.selectedChoices.length == 0) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Duid minstens één keuze aan",
                field: "input"
            })
        }
    }

    get isEmpty() {
        return this.selectedChoices.length === 0
    }
}

export class RecordChooseOneAnswer extends RecordAnswer {
    @field({ decoder: RecordChoice, nullable: true })
    selectedChoice: RecordChoice | null = null

    get stringValue() {
        return this.selectedChoice?.name ?? "/"
    }

    getWarnings(): RecordWarning[] {
        if (this.selectedChoice === null) {
            // TODO: show warning if inverted
            return []
        }

        const warnings: RecordWarning[] = []

        if (this.selectedChoice.warning && !this.selectedChoice.warning.inverted) {
            warnings.push(this.selectedChoice.warning)
        }

        for (const choice of this.settings.choices) {
            if (choice.warning && choice.warning.inverted) {
                if (this.selectedChoice.id !== choice.id) {
                    warnings.push(choice.warning)
                }
            }
        }

        return warnings
    }

    override validate() {
        if (this.settings.required && this.selectedChoice === null) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Duid een keuze aan",
                field: "input"
            })
        }
    }

    get isEmpty() {
        return this.selectedChoice === null
    }
}

export class RecordAddressAnswer extends RecordAnswer {
    @field({ decoder: Address, nullable: true })
    address: Address | null = null

    get stringValue() {
        return this.address?.toString() ?? "/"
    }

    override validate() {
        if (this.settings.required && this.address === null) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Verplicht in te vullen",
                field: "input"
            })
        }
    }

    get isEmpty() {
        return this.address === null
    }
}

export class RecordDateAnswer extends RecordAnswer {
    @field({ decoder: DateDecoder, nullable: true })
    dateValue: Date | null = null

    get stringValue() {
        return this.dateValue ? Formatter.dateIso(this.dateValue) : "/"
    }

    override validate() {
        if (this.settings.required && this.dateValue === null) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Verplicht in te vullen",
                field: "input"
            })
        }
    }

    get isEmpty() {
        return this.dateValue === null
    }
}