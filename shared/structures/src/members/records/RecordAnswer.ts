import { ArrayDecoder, AutoEncoder, BooleanDecoder, Data, Decoder,field, StringDecoder } from "@simonbackx/simple-encoding"
import { SimpleError } from "@simonbackx/simple-errors";
import { v4 as uuidv4 } from "uuid";

import { Address } from "../../addresses/Address";
import { RecordChoice, RecordSettings,RecordType } from "./RecordSettings"


export class RecordAnswer extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    /**
     * Settings of this record at the time of input. Depending on the changes, we can auto migrate some settings
     */
    @field({ decoder: RecordSettings })
    settings: RecordSettings
}

export const RecordAnswerDecoder: Decoder<RecordAnswer> = {
    decode: function (data: Data): RecordAnswer {
        const type = data.field("settings").field("type").enum(RecordType)

        switch (type) {
            case RecordType.Checkbox: return data.decode(RecordCheckboxAnswer as Decoder<RecordCheckboxAnswer>)
            case RecordType.Text: 
            case RecordType.Textarea:
                return data.decode(RecordTextAnswer as Decoder<RecordTextAnswer>)
            case RecordType.MultipleChoice: return data.decode(RecordMultipleChoiceAnswer as Decoder<RecordMultipleChoiceAnswer>)
            case RecordType.Address: return data.decode(RecordAddressAnswer as Decoder<RecordAddressAnswer>)
        }
        throw new SimpleError({
            code: "not_supported",
            message: "A property type is not supported",
            human: "Een bepaald kenmerk wordt niet ondersteund. Kijk na of je wel de laatste versie gebruikt en update indien nodig."
        })
    }
}

export class RecordTextAnswer extends RecordAnswer {
    @field({ decoder: StringDecoder })
    value = ""
}

export class RecordCheckboxAnswer extends RecordAnswer {
    @field({ decoder: BooleanDecoder })
    selected = false

    @field({ decoder: StringDecoder, optional: true })
    comments?: string
}

export class RecordMultipleChoiceAnswer extends RecordAnswer {
    @field({ decoder: new ArrayDecoder(RecordChoice) })
    selectedChoices: RecordChoice[] = []
}


export class RecordAddressAnswer extends RecordAnswer {
    @field({ decoder: Address, nullable: true })
    address: Address | null = null
}