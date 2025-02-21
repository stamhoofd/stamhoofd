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

    static forRecipient(recipient: EmailRecipient | Recipient) {
        const replacements = [...recipient.replacements, ...recipient.getDefaultReplacements()];

        return this.all.map(v => v.clone()).filter((variable) => {
            // Always supported: signInUrl + unsubscribeUrl
            if (variable.id === 'signInUrl' || variable.id === 'unsubscribeUrl') {
                return true;
            }

            const replacement = replacements.find(r => r.token === variable.id && (r.value.length > 0 || r.html !== undefined));
            if (!replacement) {
                // Not found
                return false;
            }

            return true;
        });
    }

    static get all() {
        const buttons: EditorSmartButton[] = [];

        buttons.push(EditorSmartButton.create({
            id: 'paymentUrl',
            name: 'Knop om te betalen',
            text: 'Betalen',
            hint: 'Met deze knop kunnen ontvangers betalen.',
        }));

        buttons.push(EditorSmartButton.create({
            id: 'reviewUrl',
            name: $t('d26eacf8-26b6-4fa6-8a58-1f8f256bd5fc'),
            text: $t('b782247f-6a73-4de0-8563-03cf9187b888'),
            hint: $t('21fb9a88-0fcd-4d55-8ae5-a2ef4af5637c'),
        }));

        buttons.push(EditorSmartButton.create({
            id: 'downloadUrl',
            name: 'Knop om te downloaden',
            text: 'Download',
            hint: 'Download een gekoppeld bestand.',
        }));

        buttons.push(EditorSmartButton.create({
            id: 'resetUrl',
            name: 'Knop om wachtwoord opnieuw in te stellen',
            text: 'Wachtwoord opnieuw instellen',
            hint: 'Knop waarmee gebruikers hun wachtwoord kunnen herstellen',
        }));

        buttons.push(EditorSmartButton.create({
            id: 'signInUrl',
            name: 'Knop om in te loggen',
            text: 'Open ledenportaal',
            hint: 'Als gebruikers op deze knop klikken, zorgt het systeem ervoor dat ze inloggen of registreren op het juiste e-mailadres dat al in het systeem zit.',
        }));

        // todo: make button text smart, e.g. 'view tickets' vs 'open order'
        buttons.push(EditorSmartButton.create({
            id: 'orderUrl',
            name: 'Knop naar bestelling',
            text: 'Bestelling bekijken',
            hint: 'Deze knop gaat naar het besteloverzicht, met alle informatie van de bestellingen en eventueel betalingsinstructies.',
        }));

        buttons.push(EditorSmartButton.create({
            id: 'unsubscribeUrl',
            name: 'Knop om uit te schrijven voor e-mails',
            text: 'Uitschrijven',
            hint: 'Met deze knop kan de ontvanger zich uitschrijven voor alle e-mails.',
            type: 'inline',
        }));

        buttons.push(EditorSmartButton.create({
            id: 'confirmEmailUrl',
            name: 'Knop om e-mailadres te bevestigen',
            text: 'Bevestig e-mailadres',
            hint: 'Met deze knop kan de ontvanger het e-mailadres bevestigen.',
        }));

        // Remove all smart variables that are not set in the recipients
        return buttons;
    }
}
