import { AutoEncoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { Recipient, Replacement } from '../endpoints/EmailRequest.js';
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
            name: $t(`f4d4e0b1-9fca-4d82-8b18-5c0b58794700`),
            text: $t(`e3f37ccd-a27c-4455-96f4-e33b74ae879e`),
            hint: $t(`dfb8feba-663c-41cb-9407-34707a5ab186`),
        }));

        buttons.push(EditorSmartButton.create({
            id: 'reviewUrl',
            name: $t('d26eacf8-26b6-4fa6-8a58-1f8f256bd5fc'),
            text: $t('b782247f-6a73-4de0-8563-03cf9187b888'),
            hint: $t('21fb9a88-0fcd-4d55-8ae5-a2ef4af5637c'),
        }));

        buttons.push(EditorSmartButton.create({
            id: 'downloadUrl',
            name: $t(`e96ac01e-3a88-4f2f-8ee0-9e666fd15299`),
            text: $t(`d3e021e4-a9eb-4f7e-a538-8d2dbc27341c`),
            hint: $t(`89be2c5e-f71e-4314-b91e-8394abaa07df`),
        }));

        buttons.push(EditorSmartButton.create({
            id: 'resetUrl',
            name: $t(`4b8ef510-9139-49dc-a151-31aa5b418dc7`),
            text: $t(`7cd26cd1-6d1b-4555-81d0-abcc2c43d87c`),
            hint: $t(`019a1d43-56d2-483d-8c3e-e60d00634e93`),
        }));

        buttons.push(EditorSmartButton.create({
            id: 'signInUrl',
            name: $t(`89a8dbc1-731c-4529-b2c8-44db162941fb`),
            text: $t(`dfd3083c-6483-46de-9cc8-0afeb7f021f3`),
            hint: $t(`c5fa65a4-fd68-4296-8722-bcb0604ed679`),
        }));

        // todo: make button text smart, e.g. 'view tickets' vs 'open order'
        buttons.push(EditorSmartButton.create({
            id: 'orderUrl',
            name: $t(`73a3a92f-5137-4866-8359-2d7459cde274`),
            text: $t(`191a0e4d-d813-4543-8655-92852418386d`),
            hint: $t(`78b9dc16-fb37-4d8b-8b30-263235e7367b`),
        }));

        buttons.push(EditorSmartButton.create({
            id: 'unsubscribeUrl',
            name: $t(`4f7cc2ac-d4ea-44a9-9625-a6316f8db8bd`),
            text: $t(`69aaebd1-f031-4237-8150-56e377310cf5`),
            hint: $t(`2d48ac49-d265-4e79-b897-5c5db0816dee`),
            type: 'inline',
        }));

        buttons.push(EditorSmartButton.create({
            id: 'confirmEmailUrl',
            name: $t(`8c69fe76-a8c2-496e-935f-706ab5c6003d`),
            text: $t(`5e89778b-3bbe-4300-9741-c4b9bd142b69`),
            hint: $t(`d9fbfee1-c10d-41b7-ac30-08e642854ab7`),
        }));

        // Remove all smart variables that are not set in the recipients
        return buttons;
    }
}
