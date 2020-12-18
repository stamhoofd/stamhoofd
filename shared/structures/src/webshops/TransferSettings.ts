import { StringDecoder } from "@simonbackx/simple-encoding";
import { AutoEncoder } from "@simonbackx/simple-encoding/dist/src/classes/AutoEncoder";
import { field } from "@simonbackx/simple-encoding/dist/src/decorators/Field";
import { EnumDecoder } from "@simonbackx/simple-encoding/dist/src/structs/EnumDecoder";


export enum TransferDescriptionType {
    "Structured" = "Structured", // Random structured transfer
    "Reference" = "Reference", // Reference to the order number or registration number
    "Fixed" = "Fixed" // Use a fixed description
}

export class TransferSettings extends AutoEncoder {
    @field({ decoder: new EnumDecoder(TransferDescriptionType) })
    type = TransferDescriptionType.Structured

    @field({ decoder: StringDecoder, nullable: true })
    prefix: string | null = null

    @field({ decoder: StringDecoder, nullable: true })
    iban: string | null = null

    @field({ decoder: StringDecoder, nullable: true })
    creditor: string | null = null
}
