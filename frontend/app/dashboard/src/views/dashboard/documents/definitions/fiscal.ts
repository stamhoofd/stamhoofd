import { DocumentTemplateDefinition, PropertyFilter, RecordCategory, RecordChoice, RecordSettings, RecordType, RecordWarning, RecordWarningType, ResolutionFit, ResolutionRequest } from '@stamhoofd/structures';

export const fiscal = DocumentTemplateDefinition.create({
    type: 'fiscal',
    name: $t(`Fiscaal attest kinderopvang (281.86)`),
    defaultMaxAge: 13,
    defaultMinPrice: 1,
    fieldCategories: [
        RecordCategory.create({
            id: 'organization',
            name: $t(`Vereniging`),
            description: $t(`Gegevens van de vereniging of persoon die instaat voor de opvang.`),
            records: [
                RecordSettings.create({
                    id: 'organization.name',
                    name: $t(`Naam`),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'organization.companyNumber',
                    name: $t(`KBO nummer`),
                    required: false,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'organization.address',
                    name: $t(`Adres`),
                    required: true,
                    type: RecordType.Address,
                }),
                RecordSettings.create({
                    id: 'certification.type',
                    name: $t(`Vergunningstype`),
                    description: $t(`Vergunningstype bepaalt het type van vergunning in Vak I.`),
                    required: true,
                    type: RecordType.ChooseOne,
                    choices: [
                        RecordChoice.create({
                            id: 'exception',
                            name: $t(`Vak I niet van toepassing`),
                            description: $t(`Voldoet aan de voorwaarden vermeld in puntje 2 van de document opmerkingen.`),
                        }),
                        RecordChoice.create({
                            id: 'kind-en-gezin',
                            name: $t(`Kind en Gezin / Opgroeien regie`),
                            description: $t(`is vergund, erkend, gesubsidieerd of gecontroleerd door of onder toezicht staat van of een kwaliteitslabel heeft ontvangen van Kind en Gezin / Opgroeien regie, het ‘Office de la Naissance et de l’Enfance’ of de regering van de Duitstalige Gemeenschap`),
                        }),
                        RecordChoice.create({
                            id: 'authorities',
                            name: $t(`Gemeenten, gemeenschappen of gewesten`),
                            description: $t(`is vergund, erkend, gesubsidieerd of gecontroleerd door de lokale openbare besturen of openbare besturen van de gemeenschappen of gewesten`),
                        }),
                        RecordChoice.create({
                            id: 'foreign',
                            name: $t(`Buitenlandse instellingen`),
                            description: $t(`is vergund, erkend, gesubsidieerd of gecontroleerd door of onder toezicht staat van buitenlandse openbare instellingen gevestigd in een andere lidstaat van de Europese Economische Ruimte`),
                        }),
                        RecordChoice.create({
                            id: 'schools',
                            name: $t(`Scholen`),
                            description: $t(`is verbonden met een school gevestigd in de Europese Economische Ruimte of met de inrichtende macht van een school gevestigd in de Europese Economische Ruimte,`),
                        }),
                    ],
                }),
            ],
        }),
        RecordCategory.create({
            id: 'certification',
            name: $t(`Certificeringsautoriteit`),
            description: $t(`De instantie die de opvangsinstantie heeft vergund, erkend, gesubsidieerd, er een kwaliteitslabel heeft aan toegekend of die deze controleert of er toezicht op houdt of die is verbonden met de opvanginstantie in het geval van scholen of hun inrichtende machten.`),
            records: [
                RecordSettings.create({
                    id: 'certification.name',
                    name: $t(`Naam`),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'certification.companyNumber',
                    name: $t(`KBO nummer`),
                    required: false,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'certification.address',
                    name: $t(`Adres`),
                    required: true,
                    type: RecordType.Address,
                }),
            ],
            filter: new PropertyFilter({
                fieldAnswers: {
                    'certification.type': {
                        $in: ['kind-en-gezin', 'authorities', 'foreign', 'schools'],
                    },
                },
            }, null),
        }),
        RecordCategory.create({
            id: 'signature',
            name: $t(`Ondertekening`),
            description: $t(`Persoon die de documenten ondertekent.`),
            records: [
                RecordSettings.create({
                    id: 'signature.name',
                    name: $t(`Naam`),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'signature.capacity',
                    name: $t(`Hoedanigheid`),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'signature.image',
                    name: $t(`Handtekening`),
                    description: $t(`Upload je handtekening op een witte achtergrond, met geen of weinig witruimte rondom. Tip: gebruik http://szimek.github.io/signature_pad/`),
                    required: true,
                    type: RecordType.Image,
                    resolutions: [
                        ResolutionRequest.create({
                            height: 200,
                            fit: ResolutionFit.Inside,
                        }),
                    ],
                }),
            ],
        }),
    ],
    groupFieldCategories: [],
    documentFieldCategories: [
        RecordCategory.create({
            id: 'debtor',
            name: $t(`Schuldenaar`),
            description: $t(`Persoon die heeft betaald, bij voorkeur de ouder die het kind fiscaal ten laste heeft (beide ouders hebben meestal het kind fiscaal ten laste, tenzij men niet getrouwd of niet wettelijk samenwonend is).`),
            records: [
                RecordSettings.create({
                    id: 'debtor.firstName',
                    name: $t(`Voornaam`),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'debtor.lastName',
                    name: $t(`Achternaam`),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'debtor.nationalRegisterNumber',
                    name: $t(`Rijksregisternummer`),
                    required: false,
                    type: RecordType.Text,
                    warning: RecordWarning.create({
                        id: 'missing.debtor.nationalRegisterNumber',
                        text: $t(`Rijksregisternummer schuldenaar ontbreekt. Je vult dit best aan bij één van de ouders van dit lid.`),
                        type: RecordWarningType.Warning,
                        inverted: true,
                    }),
                }),
                RecordSettings.create({
                    id: 'debtor.address',
                    name: $t(`Adres`),
                    required: true,
                    type: RecordType.Address,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'member',
            name: $t(`Gegevens lid`),
            description: $t(`Deze gegevens zijn allemaal standaard beschikbaar.`),
            records: [
                RecordSettings.create({
                    id: 'member.nationalRegisterNumber',
                    name: $t(`Rijksregisternummer`),
                    required: false,
                    type: RecordType.Text,
                    warning: RecordWarning.create({
                        id: 'missing.member.nationalRegisterNumber',
                        text: $t(`Rijksregisternummer lid ontbreekt. Je vult dit best aan bij dit lid.`),
                        type: RecordWarningType.Warning,
                        inverted: true,
                    }),
                }),
                RecordSettings.create({
                    id: 'member.firstName',
                    name: $t(`Voornaam`),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'member.lastName',
                    name: $t(`Achternaam`),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'member.birthDay',
                    name: $t(`Geboortedatum`),
                    required: true,
                    type: RecordType.Date,
                }),
                RecordSettings.create({
                    id: 'member.address',
                    name: $t(`Adres`),
                    required: true,
                    type: RecordType.Address,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'price',
            name: $t(`Prijs`),
            description: $t(`Het bedrag dat betaald werd voor de inschrijving. Dit kan automatisch uit het systeem gehaald worden, waarbij ook rekening gehouden wordt met kortingen. De dagprijs wordt berekend op basis van de begin en einddatum. Gratis inschrijvingen komen niet in aanmerking voor een fiscale aftrek en daarvoor wordt dus geen document aangemaakt.`),
            records: [
                RecordSettings.create({
                    id: 'registration.price',
                    name: $t(`Prijs`),
                    required: true,
                    type: RecordType.Price,
                    warning: RecordWarning.create({
                        id: 'missing.registration.price',
                        text: $t(`Het betaalde bedrag ontbreekt. Dit is essentieel om een geldig document af te leveren.`),
                        type: RecordWarningType.Error,
                        inverted: true,
                    }),
                }),
            ],
        }),
    ],
    exportFieldCategories: [
        RecordCategory.create({
            id: 'confirmation',
            name: $t(`Exporteren naar XML voor Belcotax`),
            description: $t(`De XML-export is complex, en je moet zorvuldig de documentatie doorlezen voor je hier aan begint.`),
            records: [
                RecordSettings.create({
                    id: 'confirmation',
                    name: $t(`Bevestiging`),
                    label: $t(`Ik bevestig dat ik de documentatie over de XML-export heb gelezen en alle stappen nauwkeurig heb gevolgd.`),
                    required: true,
                    type: RecordType.Checkbox,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'additional-belcotax',
            name: $t(`Bijkomende informatie`),
            description: $t(`We hebben nog enkele gegevens nodig die we moeten opnemen in de XML. Vul deze accuraat in.`),
            records: [
                RecordSettings.create({
                    id: 'organization.contactName',
                    name: $t(`Naam contactpersoon`),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'organization.phone',
                    name: $t(`Telefoonnummer`),
                    required: true,
                    type: RecordType.Phone,
                }),
                RecordSettings.create({
                    id: 'organization.email',
                    name: $t(`E-mailadres`),
                    required: true,
                    type: RecordType.Email,
                    description: $t(`Op dit emailadres ontvang je de bevestiging/update van de aangifte.`),
                }),
                RecordSettings.create({
                    id: 'organization.companyNumber',
                    name: $t(`Ondernemingsnummer of refertenummer`),
                    required: true,
                    type: RecordType.Text,
                    description: $t(`Is jouw vereniging een feitelijke vereniging zonder VZW, dan moet je hier het refertenummer invullen dat je bij Belcotax had aangevraagd.`),
                }),
            ],
        }),
    ],
    xmlExportDescription: $t(`Het XML-document voor het indienen van de aangifte in Belcotax.`),
});
