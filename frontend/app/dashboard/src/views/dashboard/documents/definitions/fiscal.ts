import { ChoicesFilterMode, DocumentTemplateDefinition, FilterGroupEncoded, GroupFilterMode, PropertyFilter, RecordCategory, RecordChoice, RecordSettings, RecordType, RecordWarning, RecordWarningType,ResolutionFit, ResolutionRequest, Version } from "@stamhoofd/structures";

export const fiscal = DocumentTemplateDefinition.create({
    type: 'fiscal',
    name: "Fiscaal attest kinderopvang (281.86)",
    defaultMaxAge: 13,
    defaultMinPrice: 1,
    fieldCategories: [
        RecordCategory.create({
            name: "Vereniging",
            description: "Gegevens van de vereniging of persoon die instaat voor de opvang.",
            records: [
                RecordSettings.create({
                    id: "organization.name",
                    name: "Naam",
                    required: true,
                    type: RecordType.Text
                }),
                RecordSettings.create({
                    id: "organization.companyNumber",
                    name: "KBO nummer",
                    required: false,
                    type: RecordType.Text
                }),
                RecordSettings.create({
                    id: "organization.address",
                    name: "Adres",
                    required: true,
                    type: RecordType.Address
                }),
                RecordSettings.create({
                    id: "certification.type",
                    name: "Vergunningstype",
                    description: "Vergunningstype bepaalt het type van vergunning in Vak I.",
                    required: true,
                    type: RecordType.ChooseOne,
                    choices: [
                        RecordChoice.create({
                            id: "exception",
                            name: "Vak I niet van toepassing",
                            description: 'Voldoet aan de voorwaarden vermeld in puntje 2 van de document opmerkingen.'
                        }),
                        RecordChoice.create({
                            id: "kind-en-gezin",
                            name: "Kind en Gezin / Opgroeien regie",
                            description: 'is vergund, erkend, gesubsidieerd of gecontroleerd door of onder toezicht staat van of een kwaliteitslabel heeft ontvangen van Kind en Gezin / Opgroeien regie, het ‘Office de la Naissance et de l’Enfance’ of de regering van de Duitstalige Gemeenschap'
                        }),
                        RecordChoice.create({
                            id: "authorities",
                            name: "Gemeenten, gemeenschappen of gewesten",
                            description: 'is vergund, erkend, gesubsidieerd of gecontroleerd door de lokale openbare besturen of openbare besturen van de gemeenschappen of gewesten'
                        }),
                        RecordChoice.create({
                            id: "foreign",
                            name: "Buitenlandse instellingen",
                            description: 'is vergund, erkend, gesubsidieerd of gecontroleerd door of onder toezicht staat van buitenlandse openbare instellingen gevestigd in een andere lidstaat van de Europese Economische Ruimte'
                        }),
                        RecordChoice.create({
                            id: "schools",
                            name: "Scholen",
                            description: 'is verbonden met een school gevestigd in de Europese Economische Ruimte of met de inrichtende macht van een school gevestigd in de Europese Economische Ruimte,'
                        })
                    ]
                })
            ]
        }),
        RecordCategory.create({
            name: "Certificeringsautoriteit",
            description: "De instantie die de opvangsinstantie heeft vergund, erkend, gesubsidieerd, er een kwaliteitslabel heeft aan toegekend of die deze controleert of er toezicht op houdt of die is verbonden met de opvanginstantie in het geval van scholen of hun inrichtende machten.",
            records: [
                RecordSettings.create({
                    id: "certification.name",
                    name: "Naam",
                    required: true,
                    type: RecordType.Text
                }),
                RecordSettings.create({
                    id: "certification.companyNumber",
                    name: "KBO nummer",
                    required: false,
                    type: RecordType.Text
                }),
                RecordSettings.create({
                    id: "certification.address",
                    name: "Adres",
                    required: true,
                    type: RecordType.Address
                })
            ],
            filter: new PropertyFilter(new FilterGroupEncoded({
                id: 'filter_group',
                filters: [
                    {
                        definitionId: 'record_certification.type',
                        choiceIds: ['kind-en-gezin', 'authorities', 'foreign', 'schools'],
                        mode: ChoicesFilterMode.Or
                    }
                ],
                mode: GroupFilterMode.And
            }, Version), null)
        }),
        RecordCategory.create({
            name: "Ondertekening",
            description: "Persoon die de documenten ondertekent.",
            records: [
                RecordSettings.create({
                    id: "signature.name",
                    name: "Naam",
                    required: true,
                    type: RecordType.Text
                }),
                RecordSettings.create({
                    id: "signature.capacity",
                    name: "Hoedanigheid",
                    required: true,
                    type: RecordType.Text
                }),
                RecordSettings.create({
                    id: "signature.image",
                    name: "Handtekening",
                    description: "Upload je handtekening op een witte achtergrond, met geen of weinig witruimte rondom. Tip: gebruik http://szimek.github.io/signature_pad/",
                    required: true,
                    type: RecordType.Image,
                    resolutions: [
                        ResolutionRequest.create({
                            height: 200,
                            fit: ResolutionFit.Inside
                        })
                    ]
                })
            ]
        })
    ],
    groupFieldCategories: [
        RecordCategory.create({
            name: "Periode",
            description: "Vul de exacte begin en einddatum van deze activiteit in. Voor de aangifte in 2023 mag je alleen activiteiten uit 2022 opnemen.",
            records: [
                RecordSettings.create({
                    id: "registration.startDate",
                    name: "Startdatum",
                    required: true,
                    type: RecordType.Date
                }),
                RecordSettings.create({
                    id: "registration.endDate",
                    name: "Einddatum",
                    required: true,
                    type: RecordType.Date
                }),
                RecordSettings.create({
                    id: "registration.days",
                    name: "Aantal dagen",
                    description: 'Laat leeg om automatisch te berekenen. Vul in als het aantal dagen minder is dan het aantal dagen van de start tot einddatum (inclusief beide).',
                    required: false,
                    inputPlaceholder: 'Automatisch',
                    type: RecordType.Integer
                }),
            ]
        })
    ],
    documentFieldCategories: [
        RecordCategory.create({
            name: "Schuldenaar",
            description: "Persoon die heeft betaald, bij voorkeur de ouder die het kind fiscaal ten laste heeft (beide ouders hebben meestal het kind fiscaal ten laste, tenzij men niet getrouwd of niet wettelijk samenwonend is).",
            records: [
                RecordSettings.create({
                    id: "debtor.firstName",
                    name: "Voornaam",
                    required: true,
                    type: RecordType.Text
                }),
                RecordSettings.create({
                    id: "debtor.lastName",
                    name: "Achternaam",
                    required: true,
                    type: RecordType.Text
                }),
                RecordSettings.create({
                    id: "debtor.nationalRegistryNumber",
                    name: "Rijksregisternummer",
                    required: false,
                    type: RecordType.Text,
                    warning: RecordWarning.create({
                        id: 'missing.debtor.nationalRegistryNumber',
                        text: 'Rijksregisternummer schuldenaar ontbreekt. Er is een uitzondering waardoor je het rijksregisternummer nog niet moet invullen voor aanslagjaar 2023. Maar we raden wel al aan om deze te verzamelen, en enkel leeg te laten waar je de gegevens niet op tijd hebt ontvangen.',
                        type: RecordWarningType.Warning,
                        inverted: true
                    })
                }),
                RecordSettings.create({
                    id: "debtor.address",
                    name: "Adres",
                    required: true,
                    type: RecordType.Address
                })
            ]
        }),
        RecordCategory.create({
            name: "Gegevens lid",
            description: "Deze gegevens zijn allemaal standaard beschikbaar in Stamhoofd, met uitzondering van het rijksregisternummer.",
            records: [
                RecordSettings.create({
                    id: "member.nationalRegistryNumber",
                    name: "Rijksregisternummer",
                    required: false,
                    type: RecordType.Text,
                    warning: RecordWarning.create({
                        id: 'missing.member.nationalRegistryNumber',
                        text: 'Rijksregisternummer lid ontbreekt. Er is een uitzondering waardoor je het rijksregisternummer nog niet moet invullen voor aanslagjaar 2023. Maar we raden wel al aan om deze te verzamelen, en enkel leeg te laten waar je de gegevens niet op tijd hebt ontvangen.',
                        type: RecordWarningType.Warning,
                        inverted: true
                    })
                }),
                RecordSettings.create({
                    id: "member.firstName",
                    name: "Voornaam",
                    required: true,
                    type: RecordType.Text
                }),
                RecordSettings.create({
                    id: "member.lastName",
                    name: "Achternaam",
                    required: true,
                    type: RecordType.Text
                }),
                RecordSettings.create({
                    id: "member.birthDay",
                    name: "Geboortedatum",
                    required: true,
                    type: RecordType.Date
                }),
                RecordSettings.create({
                    id: "member.address",
                    name: "Adres",
                    required: true,
                    type: RecordType.Address
                })
            ]
        }),
        RecordCategory.create({
            name: "Prijs",
            description: "Het bedrag dat betaald werd voor de inschrijving. Dit kan automatisch uit Stamhoofd gehaald worden, waarbij ook rekening gehouden wordt met kortingen. De dagprijs wordt berekend op basis van de begin en einddatum. Gratis inschrijvingen komen niet in aanmerking voor een fiscale aftrek en daarvoor wordt dus geen document aangemaakt.",
            records: [
                RecordSettings.create({
                    id: "registration.price",
                    name: "Prijs",
                    required: true,
                    type: RecordType.Price,
                    warning: RecordWarning.create({
                        id: 'missing.registration.price',
                        text: 'Het betaalde bedrag ontbreekt. Dit is essentieel om een geldig document af te leveren.',
                        type: RecordWarningType.Error,
                        inverted: true
                    })
                })
            ]
        })
    ],
    exportFieldCategories: [
        RecordCategory.create({
            name: "Exporteren naar XML voor Belcotax",
            description: "De XML-export is complex, en je moet zorvuldig de documentatie (https://www.stamhoofd.be/docs/fiscaal-attest-kinderopvang/) doorlezen voor je hier aan begint.",
            records: [
                RecordSettings.create({
                    id: "confirmation",
                    name: "Bevestiging",
                    label: "Ik bevestig dat ik de documentatie over de XML-export heb gelezen en alle stappen nauwkeurig heb gevolgd.",
                    required: true,
                    type: RecordType.Checkbox
                })
            ]
        }),
        RecordCategory.create({
            name: "Bijkomende informatie",
            description: "We hebben nog enkele gegevens nodig die we moeten opnemen in de XML. Vul deze accuraat in.",
            records: [
                RecordSettings.create({
                    id: "organization.contactName",
                    name: "Naam contactpersoon",
                    required: true,
                    type: RecordType.Text
                }),
                RecordSettings.create({
                    id: "organization.phone",
                    name: "Telefoonnummer",
                    required: true,
                    type: RecordType.Phone
                }),
                RecordSettings.create({
                    id: "organization.email",
                    name: "E-mailadres",
                    required: true,
                    type: RecordType.Email,
                    description: "Op dit emailadres ontvang je de bevestiging/update van de aangifte."
                }),
                RecordSettings.create({
                    id: "organization.companyNumber",
                    name: "Ondernemingsnummer of refertenummer",
                    required: true,
                    type: RecordType.Text,
                    description: "Is jouw vereniging een feitelijke vereniging zonder VZW, dan moet je hier het refertenummer invullen dat je bij Belcotax had aangevraagd."
                })
            ]
        })
    ],
    xmlExportDescription: "Het XML-document voor het indienen van de aangifte in Belcotax.",
})