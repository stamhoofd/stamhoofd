import { ArrayDecoder, AutoEncoder, BooleanDecoder, Data, DateDecoder, Decoder,field, StringDecoder } from "@simonbackx/simple-encoding"
import { SimpleError } from "@simonbackx/simple-errors";
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

    get stringValue() {
        return "Onbekend"
    }

    getWarnings(): RecordWarning[] {
        return []
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
            case RecordType.Textarea:
                return RecordTextAnswer
            case RecordType.MultipleChoice: return RecordMultipleChoiceAnswer
            case RecordType.ChooseOne: return RecordChooseOneAnswer
            case RecordType.Address: return RecordAddressAnswer
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
    @field({ decoder: StringDecoder })
    value = ""

    get stringValue() {
        return this.value
    }

    getWarnings(): RecordWarning[] {
        if (!this.settings.warning) {
            return []
        }
        if (this.settings.warning.inverted) {
            return this.value.length == 0 ? [this.settings.warning] : []
        }
        return this.value.length > 0 ? [this.settings.warning] : []
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
}

export class RecordChooseOneAnswer extends RecordAnswer {
    @field({ decoder: RecordChoice, nullable: true })
    selectedChoice: RecordChoice | null = null

    get stringValue() {
        return this.selectedChoice?.name ?? "/"
    }

    getWarnings(): RecordWarning[] {
        if (this.selectedChoice === null) {
            // todo: show warning if inverted
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
}

export class RecordAddressAnswer extends RecordAnswer {
    @field({ decoder: Address, nullable: true })
    address: Address | null = null

    get stringValue() {
        return this.address?.toString() ?? "/"
    }
}