import { AnyDecoder, ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, IntegerDecoder, StringDecoder, field } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";
import { StamhoofdFilterDecoder } from "../filters/new/FilteredRequest";
import { StamhoofdFilter } from "../filters/new/StamhoofdFilter";
import { EmailAttachment, Replacement } from "./EmailRequest";

export enum EmailRecipientFilterType {
    "Members" = "Members",
    "MemberParents" = "MemberParents"
}

export enum EmailStatus {
    "Draft" = "Draft",
    "Sending" = "Sending",
    "Sent" = "Sent",
    "Deleted" = "Deleted",
}

export enum EmailRecipientsStatus {
    "NotCreated" = "NotCreated",
    "Creating" = "Creating",
    "Created" = "Created"
}

export class EmailRecipientSubfilter extends AutoEncoder {
    @field({ decoder: new EnumDecoder(EmailRecipientFilterType) })
    type = EmailRecipientFilterType.Members

    @field({ decoder: StamhoofdFilterDecoder, nullable: true})
    filter: StamhoofdFilter|null = null

    @field({ decoder: StringDecoder, nullable: true})
    search: string|null = null
}


export class EmailRecipientFilter extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(EmailRecipientSubfilter) })
    filters: EmailRecipientSubfilter[] = []

    @field({ decoder: BooleanDecoder })
    groupByEmail = false
}

export class Email extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: EmailRecipientFilter })
    recipientFilter = EmailRecipientFilter.create({})

    @field({ decoder: StringDecoder, nullable: true })
    subject: string|null = null

    @field({ decoder: new EnumDecoder(EmailStatus) })
    status = EmailStatus.Draft

    @field({ decoder: new EnumDecoder(EmailRecipientsStatus) })
    recipientsStatus = EmailRecipientsStatus.NotCreated

    @field({ decoder: AnyDecoder })
    json = {}

    @field({ decoder: StringDecoder, nullable: true })
    text: string | null = null

    @field({ decoder: StringDecoder, nullable: true })
    html: string | null = null

    @field({ decoder: StringDecoder, nullable: true })
    fromAddress: string | null = null

    @field({ decoder: StringDecoder, nullable: true })
    fromName: string | null = null

    @field({ decoder: IntegerDecoder, nullable: true})
    recipientCount: number|null = null

    @field({ decoder: new ArrayDecoder(EmailAttachment) })
    attachments: EmailAttachment[] = []

    @field({ decoder: DateDecoder, nullable: true })
    sentAt: Date|null = null

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date()

    @field({ decoder: DateDecoder })
    updatedAt: Date = new Date()
}

export class EmailRecipient extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    emailId: string = ""

    @field({ decoder: StringDecoder, nullable: true })
    firstName: string | null = null

    @field({ decoder: StringDecoder, nullable: true })
    lastName: string | null = null

    @field({ decoder: StringDecoder })
    email: string

    @field({ decoder: new ArrayDecoder(Replacement) })
    replacements: Replacement[] = []

    @field({ decoder: StringDecoder, nullable: true })
    failErrorMessage: string|null = null

    @field({ decoder: IntegerDecoder })
    failCount = 0

    @field({ decoder: DateDecoder, nullable: true })
    firstFailedAt: Date|null = null

    @field({ decoder: DateDecoder, nullable: true })
    lastFailedAt: Date|null = null

    @field({ decoder: DateDecoder, nullable: true })
    sentAt: Date|null = null

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date()

    @field({ decoder: DateDecoder })
    updatedAt: Date = new Date()
}


export class EditorSmartVariable extends AutoEncoder {
    @field({ decoder: StringDecoder})
    id: string;

    @field({ decoder: StringDecoder})
    name: string;

    @field({ decoder: StringDecoder, nullable: true})
    description: string | null = null;

    @field({ decoder: StringDecoder})
    example: string;

    @field({ decoder: StringDecoder, optional: true})
    html?: string;

    @field({ decoder: StringDecoder, optional: true})
    deleteMessage?: string

    @field({ decoder: StringDecoder, optional: true})
    hint?: string;

    getJSONContent() {
        return { type: this.html ? "smartVariableBlock" : "smartVariable", attrs: { id: this.id } }
    }
}

export class EditorSmartButton extends AutoEncoder {
    @field({ decoder: StringDecoder})
    id: string;

    @field({ decoder: StringDecoder})
    name: string;
    
    @field({ decoder: StringDecoder})
    text: string;

    @field({ decoder: StringDecoder})
    hint: string;

    @field({ decoder: StringDecoder, optional: true})
    deleteMessage?: string

    @field({ decoder: new EnumDecoder(['block', 'inline']) })
    type: 'block' | 'inline' = 'block'
}

export class EmailPreview extends Email {
    @field({ decoder: EmailRecipient, nullable: true})
    exampleRecipient: EmailRecipient|null = null

    @field({ decoder: new ArrayDecoder(EditorSmartVariable) })
    smartVariables: EditorSmartVariable[] = []

    @field({ decoder: new ArrayDecoder(EditorSmartButton) })
    smartButtons: EditorSmartButton[] = []

    // todo: count stats
    // todo: bounce / spam stats
}
