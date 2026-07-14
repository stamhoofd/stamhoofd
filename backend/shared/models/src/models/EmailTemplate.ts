import { column } from '@simonbackx/simple-database';
import type { Decoder } from '@simonbackx/simple-encoding';
import { AnyDecoder, EnumDecoder, MapDecoder } from '@simonbackx/simple-encoding';
import { QueryableModel } from '@stamhoofd/sql';
import type { EmailTemplateType } from '@stamhoofd/structures';
import { EmailContent, EmailTemplate as EmailTemplateStruct } from '@stamhoofd/structures';
import { Language } from '@stamhoofd/types/Language';
import { v4 as uuidv4 } from 'uuid';

/**
 * Holds the challenges for a given email. User should not exist, since that would allow user enumeration attacks
 */
export class EmailTemplate extends QueryableModel {
    static table = 'email_templates';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    subject: string;

    @column({ type: 'string', nullable: true })
    organizationId: string | null;

    @column({ type: 'string', nullable: true })
    groupId: string | null = null;

    @column({ type: 'string', nullable: true })
    webshopId: string | null = null;

    @column({ type: 'string' })
    type: EmailTemplateType; // should be enumeration

    /** Raw json structure to edit the template */
    @column({ type: 'json', decoder: AnyDecoder })
    json: any;

    /** Template converted to HTML, with the {{replacements}} already correctly in place */
    @column({ type: 'string' })
    html: string;

    @column({ type: 'string' })
    text: string;

    /** Full content overrides per language. The default content (subject/html/text/json) is used for all languages without an override. Never contains `language` itself */
    @column({ type: 'json', decoder: new MapDecoder(new EnumDecoder(Language), EmailContent as Decoder<EmailContent>) })
    translations: Map<Language, EmailContent> = new Map();

    /** The language of the default content (subject/html/text/json); null when the content is untranslated */
    @column({ type: 'string', nullable: true })
    language: Language | null = null;

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    getStructure() {
        return EmailTemplateStruct.create(this);
    }
}
