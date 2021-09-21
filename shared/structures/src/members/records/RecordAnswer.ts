import { AutoEncoder, BooleanDecoder, Data, field, StringDecoder } from "@simonbackx/simple-encoding"
import { v4 as uuidv4 } from "uuid";

import { Address } from "../../addresses/Address";
import { RecordChoice, RecordSettings } from "./RecordSettings"

export class RecordCheckboxValue extends AutoEncoder {
    @field({ decoder: BooleanDecoder })
    selected = false

    @field({ decoder: StringDecoder, optional: true })
    comments?: string
}

export class RecordAnswer extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    /**
     * Settings of this record at the time of input. Depending on the changes, we can auto migrate some settings
     */
    @field({ decoder: RecordSettings })
    settings: RecordSettings
    
    /**
     * Depending on the settings, this will decode the value to a different type
     */
    /*@field({ decoder: StringDecoder })
    value: RecordCheckboxValue | Address | string | RecordChoice | null = null;
    */
}

export class RecordCheckboxAnswer extends RecordAnswer {
    @field({ decoder: BooleanDecoder })
    selected = false

    @field({ decoder: StringDecoder, optional: true })
    comments?: string
}

export class RecordAddressAnswer extends RecordAnswer {
    @field({ decoder: Address, nullable: true })
    address: Address | null = null
}