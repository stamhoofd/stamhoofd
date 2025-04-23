import { DocumentTemplateDefinition, RecordCategory, RecordSettings, RecordType, ResolutionFit, ResolutionRequest } from '@stamhoofd/structures';

export const participation = DocumentTemplateDefinition.create({
    type: 'participation',
    name: $t(`Deelname of inschrijvingsbewijs`),
    allowChangingMinPricePaid: true,
    defaultMinPricePaid: 1,
    fieldCategories: [
        RecordCategory.create({
            id: 'organization',
            name: $t(`Vereniging`),
            description: $t(`Gegevens van de vereniging`),
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
            ],
        }),
        RecordCategory.create({
            id: 'extra-info',
            name: $t(`Extra informatie`),
            description: $t(`Afhankelijk van de noodzaak van het deelnameattest moet je soms nog extra zaken vermelden voor bijvoorbeeld de mutualiteit. Dat kan je hier ingeven.`),
            records: [
                RecordSettings.create({
                    id: 'comments',
                    name: $t(`Bijkomende tekst`),
                    description: $t(`Deze tekst zal bovenaan op elk document worden geplaatst.`),
                    required: false,
                    type: RecordType.Textarea,
                }),

                RecordSettings.create({
                    id: 'commentsFooter',
                    name: $t(`Bijkomende tekst onderaan`),
                    description: $t(`Deze tekst zal onderaan op elk document worden geplaatst.`),
                    required: false,
                    type: RecordType.Textarea,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'signature',
            name: $t(`Ondertekening`),
            description: $t(`Persoon die de documenten ondertekent of stempel.`),
            records: [
                RecordSettings.create({
                    id: 'signature.name',
                    name: $t(`Naam`),
                    required: false,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'signature.image',
                    name: $t(`Handtekening`),
                    description: $t(`Upload je handtekening op een witte achtergrond, met geen of weinig witruimte rondom. Tip: gebruik http://szimek.github.io/signature_pad/`),
                    required: false,
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
        RecordCategory.create({
            id: 'visible-data',
            name: $t(`Zichtbare gegevens`),
            description: $t(`Kies welke gegevens je wilt vermelden op de documenten. Afhankelijk van waarvoor het document gebruikt moet worden, zijn bepaalde gegevens vereist. Sommige mutualiteiten vereisen bijvoorbeeld een rijksregisternummer.`),
            records: [
                RecordSettings.create({
                    id: 'registration.showGroup',
                    name: $t(`Toon naam groep/activiteit op document`),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'registration.showDate',
                    name: $t(`Start- en einddatum vermelden op document`),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'enable[registration.price]',
                    name: $t(`Toon bedrag`),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'registration.showPaidAt',
                    name: $t(`Toon betaaldatum op document (indien betaald)`),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'enable[member.birthDay]',
                    name: $t(`Toon geboortedatum (indien beschikbaar)`),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'enable[member.nationalRegisterNumber]',
                    name: $t(`Toon rijksregisternummer (indien beschikbaar)`),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'enable[member.email]',
                    name: $t(`Toon e-mailadres (indien beschikbaar)`),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'enable[member.address]',
                    name: $t(`Toon adres (indien beschikbaar)`),
                    required: false,
                    type: RecordType.Checkbox,
                }),
            ],
        }),
    ],
    groupFieldCategories: [],
    documentFieldCategories: [
        RecordCategory.create({
            id: 'member',
            name: $t(`Gegevens lid`),
            records: [
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
                    required: false,
                    type: RecordType.Date,
                }),
                RecordSettings.create({
                    id: 'member.address',
                    name: $t(`Adres`),
                    required: false,
                    type: RecordType.Address,
                }),
                RecordSettings.create({
                    id: 'member.nationalRegisterNumber',
                    name: $t(`Rijksregisternummer`),
                    required: false,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'member.email',
                    name: $t(`E-mailadres`),
                    required: false,
                    type: RecordType.Email,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'price',
            name: $t(`Prijs`),
            records: [
                RecordSettings.create({
                    id: 'registration.price',
                    name: $t(`Prijs`),
                    required: false,
                    type: RecordType.Price,
                }),
            ],
        }),
    ],
});
