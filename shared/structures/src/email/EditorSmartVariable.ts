import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';
import { BalanceItem, BalanceItemRelation, BalanceItemRelationType } from '../BalanceItem.js';
import { BalanceItemPaymentDetailed } from '../BalanceItemDetailed.js';
import { STPackageType, STPackageTypeHelper } from '../billing/STPackage.js';
import { Recipient, Replacement } from '../endpoints/EmailRequest.js';
import { PaymentGeneral } from '../members/PaymentGeneral.js';
import { PaymentMethod } from '../PaymentMethod.js';
import { TransferDescriptionType, TransferSettings } from '../webshops/TransferSettings.js';
import { EmailRecipient } from './Email.js';
import { EditorSmartButton } from './EditorSmartButton.js';

export class EditorSmartVariable extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    name: string;

    @field({ decoder: StringDecoder, nullable: true })
    description: string | null = null;

    @field({ decoder: StringDecoder })
    example: string;

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

            const replacement = replacements.find(r => r.token === variable.id && (r.value.length > 0 || r.html !== undefined));
            if (!replacement) {
                // Not found
                return false;
            }
            else {
                if (variable instanceof EditorSmartVariable) {
                    if (replacement.html) {
                        variable.html = replacement.html;
                    }
                    if (variable.html === undefined && replacement.value) {
                        variable.example = replacement.value;
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
        const exampleRegistrationPayment = PaymentGeneral.create({
            id: '',
            method: PaymentMethod.Transfer,
            transferDescription: '+++111/111/111+++',
            price: 1500,
            transferSettings: TransferSettings.create({
                type: TransferDescriptionType.Structured,
                iban: 'BE1234 1234 1234',
                creditor: $t('16ba3d97-5943-451d-92b5-0bf21555f7ae'),
            }),
            createdAt: new Date(),
            updatedAt: new Date(),
            balanceItemPayments: [
                BalanceItemPaymentDetailed.create({
                    price: 2500,
                    balanceItem: BalanceItem.create({
                        amount: 1,
                        unitPrice: 2500,
                        description: 'Inschrijving A',
                        relations: new Map([
                            [
                                BalanceItemRelationType.Member,
                                BalanceItemRelation.create({
                                    id: 'example-member-1',
                                    name: 'Jan Jansens',
                                }),
                            ],
                        ]),
                    }),
                }),
                BalanceItemPaymentDetailed.create({
                    price: 3000,
                    balanceItem: BalanceItem.create({
                        amount: 1,
                        unitPrice: 3000,
                        description: 'Inschrijving B',
                        relations: new Map([
                            [
                                BalanceItemRelationType.Member,
                                BalanceItemRelation.create({
                                    id: 'example-member-2',
                                    name: 'Peter Jansens',
                                }),
                            ],
                        ]),
                    }),
                }),
            ],
        });

        const exampleBalanceItem = BalanceItem.create({
            description: 'Voorbeeld item 1',
            amount: 5,
            unitPrice: 1000,
        });

        const exampleBalanceItem2 = BalanceItem.create({
            description: 'Voorbeeld item 2',
            amount: 1,
            unitPrice: 500,
        });

        const variables = [
            EditorSmartVariable.create({
                id: 'greeting',
                name: 'Begroeting',
                example: 'Dag John,',
            }),
            EditorSmartVariable.create({
                id: 'firstName',
                name: 'Voornaam',
                example: '',
                deleteMessage: 'De voornaam van één of meerdere ontvangers ontbreekt in het systeem. De magische tekstvervanging voor de voornaam is daarom weggehaald.',
            }),
            EditorSmartVariable.create({
                id: 'lastName',
                name: 'Achternaam',
                example: '',
                deleteMessage: 'De achternaam van één of meerdere ontvangers ontbreekt in het systeem. De magische tekstvervanging voor de achteraam is daarom weggehaald.',
            }),
            EditorSmartVariable.create({
                id: 'email',
                name: 'E-mailadres ontvanger',
                example: 'ontvanger@voorbeeld.com',
            }),
            EditorSmartVariable.create({
                id: 'fromAddress',
                name: 'E-mailadres verstuurder',
                example: 'verstuurder@voorbeeld.com',
            }),
            EditorSmartVariable.create({
                id: 'firstNameMember',
                name: 'Voornaam van lid',
                example: '',
                deleteMessage: 'Je kan de voornaam van een lid enkel gebruiken als je één e-mail per lid verstuurt.',
            }),
            EditorSmartVariable.create({
                id: 'lastNameMember',
                name: 'Achternaam van lid',
                example: '',
                deleteMessage: 'Je kan de achternaam van een lid enkel gebruiken als je één e-mail per lid verstuurt.',
            }),
            EditorSmartVariable.create({
                id: 'inviterName',
                name: 'Naam van uitnodiger',
                example: 'Iemand',
            }),
            EditorSmartVariable.create({
                id: 'platformOrOrganizationName',
                name: 'Naam van de vereniging of van het platform',
                example: $t('16ba3d97-5943-451d-92b5-0bf21555f7ae'),
            }),
            EditorSmartVariable.create({
                id: 'outstandingBalance',
                name: 'Openstaand bedrag',
                example: '€ 12,50',
                deleteMessage: 'Je kan het openstaand bedrag van een lid enkel gebruiken als je één e-mail per lid verstuurt.',
            }),
            EditorSmartVariable.create({
                id: 'registerUrl',
                name: 'Inschrijvingsportaal link',
                example: 'https://inschrijven.mijnvereniging.be',
            }),
            EditorSmartVariable.create({
                id: 'resetUrl',
                name: 'Voluit link om wachtwoord te herstellen',
                example: 'https://www.voorbeeld.com/heel-lange-code-waarmee-de-link-beveiligd-wordt',
            }),
            EditorSmartVariable.create({
                id: 'confirmEmailCode',
                name: 'Code om e-mail te bevestigen',
                example: '000 000',
            }),
            EditorSmartVariable.create({
                id: 'loginDetails',
                name: 'Inloggegevens',
                example: '',
                html: `<p class="description"><em>Je kan op het ledenportaal inloggen met <strong>${Formatter.escapeHtml('voorbeeld@email.com')}</strong></em></p>`,
                hint: 'Deze tekst wijzigt afhankelijk van de situatie: als de ontvanger nog geen account heeft, vertelt het op welk e-mailadres de ontvanger kan registreren. In het andere geval op welk e-mailadres de ontvanger kan inloggen.',
            }),

            EditorSmartVariable.create({
                id: 'feedbackText',
                name: $t('f90728f1-0e73-4027-9408-adfc38c9a4f0'),
                example: '',
                html: `<p></p>`,
                hint: $t('21c3edb6-8c2d-43c2-8c51-245d75006774'),
            }),

            EditorSmartVariable.create({
                id: 'groupName',
                name: 'Groepnaam',
                example: 'Kapoenen',
            }),
            EditorSmartVariable.create({
                id: 'mailDomain',
                name: 'E-maildomeinnaam',
                example: 'vereniging.com',
            }),
        ];

        // if (this.orders.length > 0) {
        variables.push(EditorSmartVariable.create({
            id: 'nr',
            name: 'Bestelnummer',
            example: '',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderPrice',
            name: 'Bestelbedrag',
            example: '',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderPrice',
            name: 'Bestelbedrag',
            example: '',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderStatus',
            name: 'Bestelstatus',
            example: '',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderTime',
            name: 'Tijdstip',
            example: '',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderDate',
            name: 'Afhaal/leverdatum',
            example: '',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderMethod',
            name: 'Afhaalmethode (afhalen, leveren, ter plaatse)',
            example: '',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderLocation',
            name: 'Locatie of leveradres',
            example: '',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'paymentMethod',
            name: 'Betaalmethode',
            example: '',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'priceToPay',
            name: 'Te betalen bedrag',
            example: '',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'pricePaid',
            name: 'Betaald bedrag',
            example: '',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'transferDescription',
            name: 'Mededeling (overschrijving)',
            example: '',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'transferBankAccount',
            name: 'Rekeningnummer (overschrijving)',
            example: '',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'transferBankCreditor',
            name: 'Begunstigde (overschrijving)',
            example: '',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderTable',
            name: 'Tabel met bestelde artikels',
            example: 'order table',
            html: '',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'overviewTable',
            name: 'Overzichtstabel',
            example: 'overview table',
            html: exampleRegistrationPayment.getDetailsHTMLTable(),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'balanceTable',
            name: 'Tabel met openstaande bedragen',
            example: 'overview table',
            html: BalanceItem.getDetailsHTMLTable([
                exampleBalanceItem,
                exampleBalanceItem2,
            ]),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'orderDetailsTable',
            name: 'Tabel met bestelgegevens',
            example: 'order details table',
            html: '',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'paymentTable',
            name: 'Tabel met betaalinstructies',
            example: 'payment table',
            html: exampleRegistrationPayment.getHTMLTable(),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'overviewContext',
            name: 'Betaalcontext',
            example: 'Inschrijving van ' + exampleRegistrationPayment.memberNames,
        }));

        variables.push(EditorSmartVariable.create({
            id: 'memberNames',
            name: $t('bd54c45e-d3df-444e-b5d9-9722a6e08999'),
            example: exampleRegistrationPayment.memberNames,
        }));

        variables.push(EditorSmartVariable.create({
            id: 'organizationName',
            name: $t('e07bc7a1-92c0-48fc-91f3-46e12573ee03'),
            example: $t('e60df757-6546-41c2-b3d3-599df08f34b6'),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'objectName',
            name: 'Naam schuldenaar',
            example: 'Jan Jansens',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'webshopName',
            name: 'Naam webshop',
            example: 'Demoshop',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'validUntil',
            name: 'Geldig tot',
            example: Formatter.dateTime(new Date()),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'validUntilDate',
            name: 'Geldig tot (datum)',
            example: Formatter.date(new Date()),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'packageName',
            name: 'Pakketnaam',
            example: STPackageTypeHelper.getName(STPackageType.Members),
        }));

        variables.push(EditorSmartVariable.create({
            id: 'submitterName',
            name: $t('5685519b-26b5-43cf-b1f3-73fdc2e642cd'),
            example: '',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'eventName',
            name: $t('cb76c693-29ff-4d41-9c45-56106a798818'),
            example: 'Activiteitsnaam',
        }));

        variables.push(EditorSmartVariable.create({
            id: 'dateRange',
            name: $t('44f90dca-5bb1-4bad-bf03-fd425cdb6a03'),
            example: '',
        }));

        return variables;
    }
}
