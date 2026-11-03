import { DocumentTemplateDefinition, RecordCategory, RecordSettings, RecordType, ResolutionFit, ResolutionRequest, TranslatedLongText, TranslatedString, TranslatedText } from '@stamhoofd/structures';

export const participation = DocumentTemplateDefinition.create({
    type: 'participation',
    name: $t(`%yB`),
    allowChangingMinPricePaid: true,
    defaultMinPricePaid: 1_00, // = 1 cent
    fieldCategories: [
        RecordCategory.create({
            id: 'organization',
            name: TranslatedText.create($t(`%1PI`)),
            description: TranslatedLongText.create($t(`%yC`)),
            records: [
                RecordSettings.create({
                    id: 'organization.name',
                    name: TranslatedText.create($t(`%1Os`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'organization.companyNumber',
                    name: TranslatedText.create($t(`%xZ`)),
                    required: false,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'organization.address',
                    name: TranslatedText.create($t(`%Cn`)),
                    required: true,
                    type: RecordType.Address,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'extra-info',
            name: TranslatedText.create($t(`%yD`)),
            description: TranslatedLongText.create($t(`%yE`)),
            records: [
                RecordSettings.create({
                    id: 'comments',
                    name: TranslatedText.create($t(`%yF`)),
                    description: TranslatedLongText.create($t(`%yG`)),
                    required: false,
                    type: RecordType.Textarea,
                }),

                RecordSettings.create({
                    id: 'commentsFooter',
                    name: TranslatedText.create($t(`%yH`)),
                    description: TranslatedLongText.create($t(`%yI`)),
                    required: false,
                    type: RecordType.Textarea,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'signature',
            name: TranslatedText.create($t(`%xo`)),
            description: TranslatedLongText.create($t(`%yJ`)),
            records: [
                RecordSettings.create({
                    id: 'signature.name',
                    name: TranslatedText.create($t(`%1Os`)),
                    required: false,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'signature.image',
                    name: TranslatedText.create($t(`%xr`)),
                    description: TranslatedLongText.create($t(`%xs`)),
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
            name: TranslatedText.create($t(`%yK`)),
            description: TranslatedLongText.create($t(`%yL`)),
            records: [
                RecordSettings.create({
                    id: 'registration.showGroup',
                    name: TranslatedText.create($t(`%yM`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'registration.showDate',
                    name: TranslatedText.create($t(`%yN`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'enable[registration.price]',
                    name: TranslatedText.create($t(`%yO`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'registration.showDayPrice',
                    name: TranslatedText.create($t('%Zip')),
                    description: TranslatedLongText.create($t('%ZiN')),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'registration.showPaidAt',
                    name: TranslatedText.create($t(`%yP`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'enable[member.birthDay]',
                    name: TranslatedText.create($t(`%yQ`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'enable[member.nationalRegisterNumber]',
                    name: TranslatedText.create($t(`%yR`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'enable[member.email]',
                    name: TranslatedText.create($t(`%yS`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'enable[member.address]',
                    name: TranslatedText.create($t(`%yT`)),
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
            name: TranslatedText.create($t(`%xv`)),
            records: [
                RecordSettings.create({
                    id: 'member.firstName',
                    name: TranslatedText.create($t(`%1MT`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'member.lastName',
                    name: TranslatedText.create($t(`%1MU`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'member.birthDay',
                    name: TranslatedText.create($t(`%17w`)),
                    required: false,
                    type: RecordType.Date,
                }),
                RecordSettings.create({
                    id: 'member.address',
                    name: TranslatedText.create($t(`%Cn`)),
                    required: false,
                    type: RecordType.Address,
                }),
                RecordSettings.create({
                    id: 'member.nationalRegisterNumber',
                    name: TranslatedText.create($t(`%wK`)),
                    required: false,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'member.email',
                    name: TranslatedText.create($t(`%1FK`)),
                    required: false,
                    type: RecordType.Email,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'price',
            name: TranslatedText.create($t(`%1IP`)),
            records: [
                RecordSettings.create({
                    id: 'registration.price',
                    name: TranslatedText.create($t(`%1IP`)),
                    required: false,
                    type: RecordType.Price,
                }),
            ],
        }),
    ],
});
