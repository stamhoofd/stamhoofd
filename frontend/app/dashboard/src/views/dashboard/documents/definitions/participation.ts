import { DocumentTemplateDefinition, PropertyFilter, RecordCategory, RecordSettings, RecordType, ResolutionFit, ResolutionRequest } from "@stamhoofd/structures";

export const participation = DocumentTemplateDefinition.create({
    type: 'participation',
    name: "Deelname of inschrijvingsbewijs",
    fieldCategories: [
        RecordCategory.create({
            name: "Vereniging",
            description: "Gegevens van de vereniging",
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
                })
            ]
        }),
        RecordCategory.create({
            name: "Extra informatie",
            description: "Afhankelijk van de noodzaak van het deelnameattest moet je soms nog extra zaken vermelden voor bijvoorbeeld de mutualiteit. Dat kan je hier ingeven.",
            records: [
                RecordSettings.create({
                    id: "comments",
                    name: "Bijkomende tekst",
                    description: 'Deze tekst zal bovenaan op elk document worden geplaatst.',
                    required: false,
                    type: RecordType.Textarea
                }),

                RecordSettings.create({
                    id: "commentsFooter",
                    name: "Bijkomende tekst onderaan",
                    description: 'Deze tekst zal onderaan op elk document worden geplaatst.',
                    required: false,
                    type: RecordType.Textarea
                })
            ]
        }),
        RecordCategory.create({
            name: "Ondertekening",
            description: "Persoon die de documenten ondertekent of stempel.",
            records: [
                RecordSettings.create({
                    id: "signature.name",
                    name: "Naam",
                    required: false,
                    type: RecordType.Text
                }),
                RecordSettings.create({
                    id: "signature.image",
                    name: "Handtekening",
                    description: "Upload je handtekening op een witte achtergrond, met geen of weinig witruimte rondom. Tip: gebruik http://szimek.github.io/signature_pad/",
                    required: false,
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
            name: "Informatie",
            records: [
                RecordSettings.create({
                    id: "registration.showGroup",
                    name: "Toon inschrijvingsgroepnaam op document",
                    required: false,
                    type: RecordType.Checkbox
                }),
                RecordSettings.create({
                    id: "registration.showDate",
                    name: "Start- en einddatum vermelden op document",
                    required: false,
                    type: RecordType.Checkbox
                })
            ]
        })
    ],
    documentFieldCategories: [
        RecordCategory.create({
            name: "Gegevens lid",
            description: "Deze gegevens zijn allemaal standaard beschikbaar in Stamhoofd.",
            records: [
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
                    required: false,
                    type: RecordType.Date
                }),
                RecordSettings.create({
                    id: "member.address",
                    name: "Adres",
                    required: false,
                    type: RecordType.Address
                })
            ]
        }),
        RecordCategory.create({
            name: "Prijs",
            description: "Het bedrag dat betaald werd voor de inschrijving. Dit kan automatisch uit Stamhoofd gehaald worden, waarbij ook rekening gehouden wordt met kortingen.",
            records: [
                RecordSettings.create({
                    id: "registration.price",
                    name: "Prijs",
                    required: false,
                    type: RecordType.Price
                })
            ]
        })
    ]
})