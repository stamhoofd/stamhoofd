import { Factory } from '@simonbackx/simple-database';

import { EmailTemplate } from '../models/index.js';
import { Organization } from '../models/Organization.js';
import { EmailTemplateType, EmailTemplate as EmailTemplateStruct } from '@stamhoofd/structures';

class Options {
    organization?: Organization;
    groupId?: string;
    webshopId?: string;
    type: EmailTemplateType;

    subject?: string;
    html?: string;
    text?: string;
}

export class EmailTemplateFactory extends Factory<Options, EmailTemplate> {
    async create(): Promise<EmailTemplate> {
        const template = new EmailTemplate();

        template.organizationId = this.options.organization?.id ?? null;
        template.groupId = this.options.groupId ?? null;
        template.webshopId = this.options.webshopId ?? null;
        template.type = this.options.type;

        template.subject = this.options.subject ?? this.options.type;
        template.json = {};
        template.html = '';
        template.text = '';

        if (this.options.html || this.options.text) {
            template.html = this.options.html ?? '<p></p>';
            template.text = this.options.text ?? 'Text';
        }
        else {
            // Automatically add all replacements in our template email
            for (const replacement of EmailTemplateStruct.getSupportedReplacementsForType(this.options.type)) {
                template.html += `<p>${replacement.token}: {{${replacement.token}}}</p>`;
                template.text += `${replacement.token}: {{${replacement.token}}}\n`;
            }
        }

        await template.save();
        return template;
    }
}
