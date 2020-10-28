import { ArrayDecoder, AutoEncoder, BooleanDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

export class Category extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder })
    description = ""

    @field({ decoder: BooleanDecoder })
    enabled = true

    @field({ decoder: new ArrayDecoder(StringDecoder) })
    productIds: string[] = []
}