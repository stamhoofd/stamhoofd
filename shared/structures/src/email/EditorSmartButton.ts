import { AutoEncoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import type { Replacement } from '../endpoints/EmailRequest.js';
import { Recipient } from '../endpoints/EmailRequest.js';
import { EmailRecipient } from './Email.js';
import { EditorSmartVariable } from './EditorSmartVariable.js';

export class EditorSmartButton extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    name: string;

    @field({ decoder: StringDecoder })
    text: string;

    @field({ decoder: StringDecoder })
    hint: string;

    @field({ decoder: StringDecoder, optional: true })
    deleteMessage?: string;

    @field({ decoder: new EnumDecoder(['block', 'inline']) })
    type: 'block' | 'inline' = 'block';

    static forReplacements(replacements: Replacement[]) {
        return EditorSmartVariable.fillExamples(this.all.map(v => v.clone()), replacements);
    }

    static get all() {
        const buttons: EditorSmartButton[] = [];

        buttons.push(EditorSmartButton.create({
            id: 'paymentUrl',
            name: $t(`%oH`),
            text: $t(`%eX`),
            hint: $t(`%oI`),
        }));

        buttons.push(EditorSmartButton.create({
            id: 'reviewUrl',
            name: $t('%Ad'),
            text: $t('%Ae'),
            hint: $t('%Af'),
        }));

        buttons.push(EditorSmartButton.create({
            id: 'downloadUrl',
            name: $t(`%oJ`),
            text: $t(`%2E`),
            hint: $t(`%oK`),
        }));

        buttons.push(EditorSmartButton.create({
            id: 'resetUrl',
            name: $t(`%oL`),
            text: $t(`%oM`),
            hint: $t(`%oN`),
        }));

        buttons.push(EditorSmartButton.create({
            id: 'signInUrl',
            name: $t(`%oO`),
            text: $t(`%oP`),
            hint: $t(`%oQ`),
        }));

        // todo: make button text smart, e.g. 'view tickets' vs 'open order'
        buttons.push(EditorSmartButton.create({
            id: 'orderUrl',
            name: $t(`%oR`),
            text: $t(`%oS`),
            hint: $t(`%oT`),
        }));

        buttons.push(EditorSmartButton.create({
            id: 'unsubscribeUrl',
            name: $t(`%oU`),
            text: $t(`%zu`),
            hint: $t(`%oV`),
            type: 'inline',
        }));

        buttons.push(EditorSmartButton.create({
            id: 'confirmEmailUrl',
            name: $t(`%oW`),
            text: $t(`%oX`),
            hint: $t(`%oY`),
        }));

        // Remove all smart variables that are not set in the recipients
        return buttons;
    }
}
