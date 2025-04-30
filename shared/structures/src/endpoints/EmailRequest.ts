import { ArrayDecoder, AutoEncoder, BooleanDecoder, EmailDecoder, field, RecordDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

export class EmailInformation extends AutoEncoder {
    @field({ decoder: StringDecoder })
    email: string;

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
    @field({ decoder: StringDecoder })
    token: string;

    @field({ decoder: StringDecoder })
    value = '';

    @field({ decoder: StringDecoder, optional: true })
    html?: string;
}

export class Recipient extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    firstName: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 112 })
    lastName: string | null = null;

    @field({ decoder: EmailDecoder })
    email: string;

    @field({ decoder: new ArrayDecoder(Replacement) })
    replacements: Replacement[] = [];

    @field({ decoder: new RecordDecoder(StringDecoder, StringDecoder), version: 209, nullable: true })
    headers: Record<string, string> | null = null;

    /**
     * Set this to create a replacement called signInUrl, which will auto sign in/sign up the user
     * Note: the e-mail is matched with the user id, if it doesn't match, the sign-in button will contain a simple (non smart) url
     */
    @field({ decoder: StringDecoder, nullable: true, version: 80 })
    userId: string | null = null;

    /// For reference and filtering
    /**
     * @deprecated
     * Use types instead
     */
    @field({ decoder: StringDecoder, nullable: true, version: 96 })
    type: string | null = null;

    /// For reference and filtering
    @field({ decoder: new ArrayDecoder(StringDecoder), optional: true })
    types: string[] = [];

    getDefaultReplacements() {
        return [
            Replacement.create({
                token: 'firstName',
                value: this.firstName ?? '',
            }),
            Replacement.create({
                token: 'lastName',
                value: this.lastName ?? '',
            }),
            Replacement.create({
                token: 'email',
                value: this.email,
            }),
            Replacement.create({
                token: 'greeting',
                value: this.firstName ? $t(`Dag {name},`, { name: this.firstName }) : $t(`Hallo!`),
            }),
        ];
    }

    merge(recipient: Recipient) {
        this.firstName = this.firstName !== null && this.firstName.length > 0 ? this.firstName : recipient.firstName;
        this.lastName = this.lastName !== null && this.lastName.length > 0 ? this.lastName : recipient.lastName;
        for (const replacement of recipient.replacements) {
            const existing = this.replacements.find(r => r.token == replacement.token);
            if (!existing) {
                this.replacements.push(replacement);
            }
            else {
                if (existing.value.length == 0) {
                    existing.value = replacement.value;
                }
            }
        }
        this.userId = this.userId ?? recipient.userId;
        this.types = Formatter.uniqueArray(this.types.concat(recipient.types));
    }

    /**
     * Remove duplicate replacements, keeping the last added replacements
     */
    removeDuplicates() {
        const replacements: Replacement[] = [];
        for (const replacement of this.replacements.slice().reverse()) {
            if (!replacements.find(r => r.token === replacement.token)) {
                replacements.unshift(replacement);
            }
        }
        this.replacements = replacements;
    }
}

export class EmailAttachment extends AutoEncoder {
    /**
     * Silently added, incompatible change but shouldn't be a problem since this was only used temporarily
     */
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    filename: string;

    @field({ decoder: StringDecoder })
    contentType: string;

    /**
     * base64 encoded content
     */
    @field({ decoder: StringDecoder })
    content: string;

    get bytes() {
        // Calculates bytes of base64 string
        return Math.ceil((this.content.length / 4) * 3) - (this.content.endsWith('==') ? 2 : this.content.endsWith('=') ? 1 : 0);
    }
}

export class EmailRequest extends AutoEncoder {
    /**
     * ID of the sender email address
     */
    @field({ decoder: StringDecoder })
    emailId: string;

    @field({ decoder: StringDecoder })
    subject: string;

    @field({ decoder: new ArrayDecoder(Recipient) })
    recipients: Recipient[];

    @field({ decoder: StringDecoder, nullable: true })
    text: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    html: string | null = null;

    @field({ decoder: new ArrayDecoder(EmailAttachment), version: 11 })
    attachments: EmailAttachment[] = [];

    @field({ decoder: new ArrayDecoder(Replacement), version: 220 })
    defaultReplacements: Replacement[] = [];
}
