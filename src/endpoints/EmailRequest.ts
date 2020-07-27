import { ArrayDecoder,AutoEncoder, EmailDecoder,field, StringDecoder } from '@simonbackx/simple-encoding';

export class Replacement extends AutoEncoder {
    @field({ decoder: StringDecoder})
    token: string 

    @field({ decoder: StringDecoder })
    value: string 
}

export class Recipient extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    firstName: string | null = null

    @field({ decoder: EmailDecoder })
    email: string

    @field({ decoder: new ArrayDecoder(Replacement) })
    replacements: Replacement[] = []
}

export class EmailRequest extends AutoEncoder {
    /**
     * ID of the sender email address
     */
    @field({ decoder: StringDecoder })
    emailId: string

    @field({ decoder: StringDecoder })
    subject: string

    @field({ decoder: new ArrayDecoder(Recipient) })
    recipients: Recipient[]

    @field({ decoder: StringDecoder, nullable: true })
    text: string | null = null

    @field({ decoder: StringDecoder, nullable: true })
    html: string | null = null
}