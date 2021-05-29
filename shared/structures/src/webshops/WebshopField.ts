import { AutoEncoder, BooleanDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { SimpleError } from "@simonbackx/simple-errors";
import { v4 as uuidv4 } from "uuid";

export class WebshopField extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder })
    description = ""

    @field({ decoder: StringDecoder })
    placeholder = ""

    @field({ decoder: BooleanDecoder, version: 95 })
    required = true
}

export class WebshopFieldAnswer extends AutoEncoder {
    @field({ decoder: WebshopField })
    field: WebshopField

    @field({ decoder: StringDecoder })
    answer = ""

    validate() {
        if (this.field.required && this.answer.length == 0) {
            throw new SimpleError({
                code: "invalid_field",
                message: "This field is required",
                human: "Je moet dit veld verplicht invullen",
                field: "answer"
            })
        }
    }
}