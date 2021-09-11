import { ArrayDecoder,AutoEncoder, BooleanDecoder, EmailDecoder,field, StringDecoder } from '@simonbackx/simple-encoding';

export class EmailInformation extends AutoEncoder {
    @field({ decoder: StringDecoder })
    email: string

    @field({ decoder: BooleanDecoder })
    markedAsSpam = false;

    @field({ decoder: BooleanDecoder })
    hardBounce = false;

    @field({ decoder: BooleanDecoder })
    unsubscribedMarketing = false;

    @field({ decoder: BooleanDecoder })
    unsubscribedAll = false;
}

export class Replacement extends AutoEncoder {
    @field({ decoder: StringDecoder})
    token: string 

    @field({ decoder: StringDecoder })
    value: string 
}

export class Recipient extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    firstName: string | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 112 })
    lastName: string | null = null

    @field({ decoder: EmailDecoder })
    email: string

    @field({ decoder: new ArrayDecoder(Replacement) })
    replacements: Replacement[] = []

    /**
     * Set this to create a replacement called signInUrl, which will auto sign in/sign up the user
     * Note: the e-mail is matched with the user id, if it doesn't match, the sign-in button will contain a simple (non smart) url
     */
    @field({ decoder: StringDecoder, nullable: true, version: 80 })
    userId: string | null = null

    /// For reference and filtering
    @field({ decoder: StringDecoder, nullable: true, version: 96 })
    type: string | null = null
}

export class EmailAttachment extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    filename: string | null = null

    @field({ decoder: StringDecoder, nullable: true })
    contentType: string | null = null

    /**
     * base64 encoded content
     */
    @field({ decoder: StringDecoder })
    content: string;
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

    @field({ decoder: new ArrayDecoder(EmailAttachment), version: 11 })
    attachments: EmailAttachment[] = []
}