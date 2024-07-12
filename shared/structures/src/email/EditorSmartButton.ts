import { AutoEncoder, field, StringDecoder, EnumDecoder } from "@simonbackx/simple-encoding";
import { Replacement } from "../endpoints/EmailRequest";

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

    static forRecipient(recipient: {replacements: Replacement[]}) {
        return this.all.map(v => v.clone()).filter(variable => {
            const replacement = recipient.replacements.find(r => r.token === variable.id && (r.value.length > 0 || r.html !== undefined))
            if (!replacement) {
                // Not found
                return false
            }
            return true
        })
    }

    static get all() {
        const buttons: EditorSmartButton[] = []
        buttons.push(EditorSmartButton.create({
            id: "signInUrl",
            name: "Knop om in te loggen",
            text: "Open ledenportaal",
            hint: "Als gebruikers op deze knop klikken, zorgt het systeem ervoor dat ze inloggen of registreren op het juiste e-mailadres dat al in het systeem zit."
        }))

        // todo: make button text smart, e.g. 'view tickets' vs 'open order'
        buttons.push(EditorSmartButton.create({
            id: "orderUrl",
            name: "Knop naar bestelling",
            text: 'Bestelling bekijken',
            hint: "Deze knop gaat naar het besteloverzicht, met alle informatie van de bestellingen en eventueel betalingsinstructies."
        }))

        buttons.push(EditorSmartButton.create({
            id: "unsubscribeUrl",
            name: "Knop om uit te schrijven voor e-mails",
            text: "Uitschrijven",
            hint: "Met deze knop kan de ontvanger zich uitschrijven voor alle e-mails.",
            type: 'inline'
        }))

        // Remove all smart variables that are not set in the recipients
        return buttons
    }
}
