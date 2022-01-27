import { AutoEncoder, EnumDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

export enum EmailTemplateType {
    /**
     * Template created by the user to send manually
     */
    UserGenerated = "UserGenerated",

    RegistrationConfirmation = "RegistrationConfirmation",
}
export class EmailTemplate extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    @field({ decoder: StringDecoder })
    subject = ""

    @field({ decoder: new EnumDecoder(EmailTemplateType) })
    type: EmailTemplateType = EmailTemplateType.UserGenerated

    @field({ decoder: StringDecoder })
    html = ""

    @field({ decoder: StringDecoder })
    json = ""

    @field({ decoder: StringDecoder, nullable: true })
    from: string | null = null
}