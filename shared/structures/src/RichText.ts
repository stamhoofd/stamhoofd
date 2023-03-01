import { AutoEncoder, field, StringDecoder } from "@simonbackx/simple-encoding";

export class RichText extends AutoEncoder {
    @field({ decoder: StringDecoder })
    html = ""

    @field({ decoder: StringDecoder })
    text = ""

    toString() {
        return this.text
    }
}