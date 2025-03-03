import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { Recipient, Replacement } from '../endpoints/EmailRequest.js';
import { EditorSmartButton } from './EditorSmartButton.js';
import { EmailRecipient } from './Email.js';
import { ExampleReplacements } from './exampleReplacements.js';

export class EditorSmartVariable extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    name: string;

    @field({ decoder: StringDecoder, nullable: true })
    description: string | null = null;

    @field({ decoder: StringDecoder })
    example = '';

    @field({ decoder: StringDecoder, optional: true })
    html?: string;

    @field({ decoder: StringDecoder, optional: true })
    deleteMessage?: string;

    @field({ decoder: StringDecoder, optional: true })
    hint?: string;

    getJSONContent() {
        return { type: this.html ? 'smartVariableBlock' : 'smartVariable', attrs: { id: this.id } };
    }

    static forRecipient(recipient: EmailRecipient | Recipient) {
        const replacements = [...recipient.replacements, ...recipient.getDefaultReplacements()];
        return this.forReplacements(replacements);
    }

    static forReplacements(replacements: Replacement[]) {
        return this.fillExamples(this.all.map(v => v.clone()), replacements);
    }

    static fillExamples<T extends EditorSmartVariable | EditorSmartButton>(list: T[], replacements: Replacement[]) {
        return list.filter((variable) => {
            // Always supported: signInUrl + unsubscribeUrl
            if (variable.id === 'signInUrl' || variable.id === 'unsubscribeUrl') {
                return true;
            }

            const replacement = replacements.find(r => r.token === variable.id && (r.value || r.html));
            if (!replacement) {
                // Not found
                return false;
            }
            else {
                if (variable instanceof EditorSmartVariable) {
                    if (replacement.html) {
                        variable.html = replacement.html;
                        variable.example = '';
                    }
                    else if (replacement.value) {
                        variable.example = replacement.value;
                        variable.html = undefined;
                    }
                }
                else {
                    // Do not change text
                }
            }
            return true;
        });
    }

    static get all() {
        /**
         * Note: please also add the corresponding default replacements to `shared/structures/src/email/exampleReplacements.ts`
         * and only add the example or html there. You should not fill it in here, that will happen automatically.
         */
        const variables = [
            EditorSmartVariable.create({
                id: 'greeting',
                name: 'Begroeting',
            }),
            EditorSmartVariable.create({
                id: 'firstName',
                name: 'Voornaam',
                deleteMessage: 'De voornaam van één of meerdere ontvangers ontbreekt in het systeem. De magische tekstvervanging voor de voornaam is daarom weggehaald.',
            }),
            EditorSmartVariable.create({
                id: 'lastName',
                name: 'Achternaam',
                deleteMessage: 'De achternaam van één of meerdere ontvangers ontbreekt in het systeem. De magische tekstvervanging voor de achteraam is daarom weggehaald.',
            }),
            EditorSmartVariable.create({
                id: 'email',
                name: 'E-mailadres ontvanger',
            }),
            EditorSmartVariable.create({
                id: 'fromAddress',
                name: 'E-mailadres verstuurder',
            }),
            EditorSmartVariable.create({
                id: 'firstNameMember',
                name: 'Voornaam van lid',
                deleteMessage: 'Je kan de voornaam van een lid enkel gebruiken als je één e-mail per lid verstuurt.',
            }),
            EditorSmartVariable.create({
                id: 'lastNameMember',
                name: 'Achternaam van lid',
                deleteMessage: 'Je kan de achternaam van een lid enkel gebruiken als je één e-mail per lid verstuurt.',
            }),
            EditorSmartVariable.create({
                id: 'inviterName',
                name: 'Naam van uitnodiger',
            }),
            EditorSmartVariable.create({
                id: 'platformOrOrganizationName',
                name: 'Naam van de vereniging of van het platform',
            }),
            EditorSmartVariable.create({
                id: 'outstandingBalance',
                name: 'Openstaand bedrag',
                deleteMessage: 'Je kan het openstaand bedrag van een lid enkel gebruiken als je één e-mail per lid verstuurt.',
            }),
            EditorSmartVariable.create({
                id: 'registerUrl',
                name: 'Inschrijvingsportaal link',
            }),
            EditorSmartVariable.create({
                id: 'resetUrl',
                name: 'Voluit link om wachtwoord te herstellen',
            }),
            EditorSmartVariable.create({
                id: 'confirmEmailCode',
                name: 'Code om e-mail te bevestigen',
            }),
            EditorSmartVariable.create({
                id: 'loginDetails',
                name: 'Inloggegevens',
                hint: 'Deze tekst wijzigt afhankelijk van de situatie: als de ontvanger nog geen account heeft, vertelt het op welk e-mailadres de ontvanger kan registreren. In het andere geval op welk e-mailadres de ontvanger kan inloggen.',
            }),

            EditorSmartVariable.create({
                id: 'feedbackText',
                name: $t('f90728f1-0e73-4027-9408-adfc38c9a4f0'),
                hint: $t('21c3edb6-8c2d-43c2-8c51-245d75006774'),
            }),

            EditorSmartVariable.create({
                id: 'groupName',
                name: 'Groepnaam',
            }),
            EditorSmartVariable.create({
                id: 'mailDomain',
                name: 'E-maildomeinnaam',
            }),
        ];

        // if (this.orders.length > 0) {
        variables.push(EditorSmartVariable.create({
            id: 'nr',
            name: 'Bestelnummer',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderPrice',
            name: 'Bestelbedrag',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderPrice',
            name: 'Bestelbedrag',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderStatus',
            name: 'Bestelstatus',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderTime',
            name: 'Tijdstip',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderDate',
            name: 'Afhaal/leverdatum',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderMethod',
            name: 'Afhaalmethode (afhalen, leveren, ter plaatse)',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderLocation',
            name: 'Locatie of leveradres',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'paymentMethod',
            name: 'Betaalmethode',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'priceToPay',
            name: 'Te betalen bedrag',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'pricePaid',
            name: 'Betaald bedrag',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'transferDescription',
            name: 'Mededeling (overschrijving)',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'transferBankAccount',
            name: 'Rekeningnummer (overschrijving)',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'transferBankCreditor',
            name: 'Begunstigde (overschrijving)',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderTable',
            name: 'Tabel met bestelde artikels',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'overviewTable',
            name: 'Overzichtstabel',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'balanceTable',
            name: 'Tabel met openstaande bedragen',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderDetailsTable',
            name: 'Tabel met bestelgegevens',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'paymentTable',
            name: 'Tabel met betaalinstructies',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'overviewContext',
            name: 'Betaalcontext',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'memberNames',
            name: $t('bd54c45e-d3df-444e-b5d9-9722a6e08999'),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'organizationName',
            name: $t('e07bc7a1-92c0-48fc-91f3-46e12573ee03'),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'objectName',
            name: 'Naam schuldenaar',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'webshopName',
            name: 'Naam webshop',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'validUntil',
            name: 'Geldig tot',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'validUntilDate',
            name: 'Geldig tot (datum)',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'packageName',
            name: 'Pakketnaam',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'submitterName',
            name: $t('5685519b-26b5-43cf-b1f3-73fdc2e642cd'),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'eventName',
            name: $t('cb76c693-29ff-4d41-9c45-56106a798818'),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'dateRange',
            name: $t('44f90dca-5bb1-4bad-bf03-fd425cdb6a03'),
        }));

        // Fill examples using the example replacements
        this.fillExamples(variables, Object.values(ExampleReplacements.all));

        return variables;
    }
}
