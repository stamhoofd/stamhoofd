import { DocumentTemplateDefinition, PropertyFilter, RecordCategory, RecordChoice, RecordSettings, RecordType, RecordWarning, RecordWarningType, ResolutionFit, ResolutionRequest, TranslatedLongText, TranslatedRichText, TranslatedString, TranslatedText } from '@stamhoofd/structures';

export const fiscal = DocumentTemplateDefinition.create({
    type: 'fiscal',
    name: $t(`%xX`),
    defaultMaxAge: 13,
    defaultMaxAgeSevereDisability: 20,
    defaultMinPrice: 1_00, // = 1 cent
    fieldCategories: [
        RecordCategory.create({
            id: 'organization',
            name: TranslatedText.create($t(`%1PI`)),
            description: TranslatedLongText.create($t(`%xY`)),
            records: [
                RecordSettings.create({
                    id: 'organization.companyName',
                    name: TranslatedText.create($t(`%1Os`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'organization.companyNumber',
                    name: TranslatedText.create($t(`%y8`)),
                    required: false,
                    type: RecordType.Text,
                    description: TranslatedLongText.create($t(`%y9`)),
                }),
                RecordSettings.create({
                    id: 'organization.companyAddress',
                    name: TranslatedText.create($t(`%Cn`)),
                    required: true,
                    type: RecordType.Address,
                }),
                RecordSettings.create({
                    id: 'certification.type',
                    name: TranslatedText.create($t(`%xa`)),
                    description: TranslatedLongText.create($t(`%xb`)),
                    required: true,
                    type: RecordType.ChooseOne,
                    choices: [
                        RecordChoice.create({
                            id: 'exception',
                            name: TranslatedText.create($t(`%xc`)),
                            description: TranslatedRichText.fromText($t(`%xd`)),
                        }),
                        RecordChoice.create({
                            id: 'kind-en-gezin',
                            name: TranslatedText.create($t(`%xe`)),
                            description: TranslatedRichText.fromText($t(`%xf`)),
                        }),
                        RecordChoice.create({
                            id: 'authorities',
                            name: TranslatedText.create($t(`%xg`)),
                            description: TranslatedRichText.fromText($t(`%xh`)),
                        }),
                        RecordChoice.create({
                            id: 'foreign',
                            name: TranslatedText.create($t(`%xi`)),
                            description: TranslatedRichText.fromText($t(`%xj`)),
                        }),
                        RecordChoice.create({
                            id: 'schools',
                            name: TranslatedText.create($t(`%xk`)),
                            description: TranslatedRichText.fromText($t(`%xl`)),
                        }),
                    ],
                }),
            ],
        }),
        RecordCategory.create({
            id: 'certification',
            name: TranslatedText.create($t(`%xm`)),
            description: TranslatedLongText.create($t(`%xn`)),
            records: [
                RecordSettings.create({
                    id: 'certification.name',
                    name: TranslatedText.create($t(`%1Os`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'certification.companyNumber',
                    name: TranslatedText.create($t(`%xZ`)),
                    required: false,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'certification.address',
                    name: TranslatedText.create($t(`%Cn`)),
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
            name: TranslatedText.create($t(`%xo`)),
            description: TranslatedLongText.create($t(`%xp`)),
            records: [
                RecordSettings.create({
                    id: 'signature.name',
                    name: TranslatedText.create($t(`%1Os`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'signature.capacity',
                    name: TranslatedText.create($t(`%xq`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'signature.image',
                    name: TranslatedText.create($t(`%xr`)),
                    description: TranslatedLongText.create($t(`%xs`)),
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
            name: TranslatedText.create($t(`%Mn`)),
            description: TranslatedLongText.create($t(`%xt`)),
            records: [
                RecordSettings.create({
                    id: 'debtor.firstName',
                    name: TranslatedText.create($t(`%1MT`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'debtor.lastName',
                    name: TranslatedText.create($t(`%1MU`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'debtor.nationalRegisterNumber',
                    name: TranslatedText.create($t(`%wK`)),
                    required: false,
                    type: RecordType.Text,
                    warning: RecordWarning.create({
                        id: 'missing.debtor.nationalRegisterNumber',
                        text: TranslatedRichText.fromText($t(`%xu`)),
                        type: RecordWarningType.Warning,
                        inverted: true,
                    }),
                }),
                RecordSettings.create({
                    id: 'debtor.address',
                    name: TranslatedText.create($t(`%Cn`)),
                    required: true,
                    type: RecordType.Address,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'member',
            name: TranslatedText.create($t(`%xv`)),
            description: TranslatedLongText.create($t(`%xw`)),
            records: [
                RecordSettings.create({
                    id: 'member.nationalRegisterNumber',
                    name: TranslatedText.create($t(`%wK`)),
                    required: false,
                    type: RecordType.Text,
                    warning: RecordWarning.create({
                        id: 'missing.member.nationalRegisterNumber',
                        text: TranslatedRichText.fromText($t(`%xx`)),
                        type: RecordWarningType.Warning,
                        inverted: true,
                    }),
                }),
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
                    required: true,
                    type: RecordType.Date,
                }),
                RecordSettings.create({
                    id: 'member.address',
                    name: TranslatedText.create($t(`%Cn`)),
                    required: true,
                    type: RecordType.Address,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'price',
            name: TranslatedText.create($t(`%1IP`)),
            description: TranslatedLongText.create($t(`%xy`)),
            records: [
                RecordSettings.create({
                    id: 'registration.price',
                    name: TranslatedText.create($t(`%1IP`)),
                    required: true,
                    type: RecordType.Price,
                    warning: RecordWarning.create({
                        id: 'missing.registration.price',
                        text: TranslatedRichText.fromText($t(`%xz`)),
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
            name: TranslatedText.create($t(`%y0`)),
            description: TranslatedLongText.create($t(`%y1`)),
            records: [
                RecordSettings.create({
                    id: 'confirmation',
                    name: TranslatedText.create($t(`%y2`)),
                    label: TranslatedText.create($t(`%y3`)),
                    required: true,
                    type: RecordType.Checkbox,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'additional-belcotax',
            name: TranslatedText.create($t(`%y4`)),
            description: TranslatedLongText.create($t(`%y5`)),
            records: [
                RecordSettings.create({
                    id: 'organization.contactName',
                    name: TranslatedText.create($t(`%y6`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'organization.phone',
                    name: TranslatedText.create($t(`%wD`)),
                    required: true,
                    type: RecordType.Phone,
                }),
                RecordSettings.create({
                    id: 'organization.email',
                    name: TranslatedText.create($t(`%1FK`)),
                    required: true,
                    type: RecordType.Email,
                    description: TranslatedLongText.create($t(`%y7`)),
                }),
                RecordSettings.create({
                    id: 'organization.companyNumber',
                    name: TranslatedText.create($t(`%y8`)),
                    required: true,
                    type: RecordType.Text,
                    description: TranslatedLongText.create($t(`%y9`)),
                }),
            ],
        }),
    ],
    xmlExportDescription: $t(`%yA`),
});
