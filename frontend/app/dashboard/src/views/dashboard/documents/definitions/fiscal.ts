import { DocumentTemplateDefinition, PropertyFilter, RecordCategory, RecordChoice, RecordSettings, RecordType, RecordWarning, RecordWarningType, ResolutionFit, ResolutionRequest, TranslatedString } from '@stamhoofd/structures';

export const fiscal = DocumentTemplateDefinition.create({
    type: 'fiscal',
    name: $t(`%xX`),
    defaultMaxAge: 13,
    defaultMinPrice: 1_00, // = 1 cent
    fieldCategories: [
        RecordCategory.create({
            id: 'organization',
            name: TranslatedString.create($t(`%1PI`)),
            description: TranslatedString.create($t(`%xY`)),
            records: [
                RecordSettings.create({
                    id: 'organization.companyName',
                    name: TranslatedString.create($t(`%1Os`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'organization.companyNumber',
                    name: TranslatedString.create($t(`%y8`)),
                    required: false,
                    type: RecordType.Text,
                    description: TranslatedString.create($t(`%y9`)),
                }),
                RecordSettings.create({
                    id: 'organization.companyAddress',
                    name: TranslatedString.create($t(`%Cn`)),
                    required: true,
                    type: RecordType.Address,
                }),
                RecordSettings.create({
                    id: 'certification.type',
                    name: TranslatedString.create($t(`%xa`)),
                    description: TranslatedString.create($t(`%xb`)),
                    required: true,
                    type: RecordType.ChooseOne,
                    choices: [
                        RecordChoice.create({
                            id: 'exception',
                            name: TranslatedString.create($t(`%xc`)),
                            description: TranslatedString.create($t(`%xd`)),
                        }),
                        RecordChoice.create({
                            id: 'kind-en-gezin',
                            name: TranslatedString.create($t(`%xe`)),
                            description: TranslatedString.create($t(`%xf`)),
                        }),
                        RecordChoice.create({
                            id: 'authorities',
                            name: TranslatedString.create($t(`%xg`)),
                            description: TranslatedString.create($t(`%xh`)),
                        }),
                        RecordChoice.create({
                            id: 'foreign',
                            name: TranslatedString.create($t(`%xi`)),
                            description: TranslatedString.create($t(`%xj`)),
                        }),
                        RecordChoice.create({
                            id: 'schools',
                            name: TranslatedString.create($t(`%xk`)),
                            description: TranslatedString.create($t(`%xl`)),
                        }),
                    ],
                }),
            ],
        }),
        RecordCategory.create({
            id: 'certification',
            name: TranslatedString.create($t(`%xm`)),
            description: TranslatedString.create($t(`%xn`)),
            records: [
                RecordSettings.create({
                    id: 'certification.name',
                    name: TranslatedString.create($t(`%1Os`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'certification.companyNumber',
                    name: TranslatedString.create($t(`%xZ`)),
                    required: false,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'certification.address',
                    name: TranslatedString.create($t(`%Cn`)),
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
            name: TranslatedString.create($t(`%xo`)),
            description: TranslatedString.create($t(`%xp`)),
            records: [
                RecordSettings.create({
                    id: 'signature.name',
                    name: TranslatedString.create($t(`%1Os`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'signature.capacity',
                    name: TranslatedString.create($t(`%xq`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'signature.image',
                    name: TranslatedString.create($t(`%xr`)),
                    description: TranslatedString.create($t(`%xs`)),
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
            name: TranslatedString.create($t(`%Mn`)),
            description: TranslatedString.create($t(`%xt`)),
            records: [
                RecordSettings.create({
                    id: 'debtor.firstName',
                    name: TranslatedString.create($t(`%1MT`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'debtor.lastName',
                    name: TranslatedString.create($t(`%1MU`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'debtor.nationalRegisterNumber',
                    name: TranslatedString.create($t(`%wK`)),
                    required: false,
                    type: RecordType.Text,
                    warning: RecordWarning.create({
                        id: 'missing.debtor.nationalRegisterNumber',
                        text: TranslatedString.create($t(`%xu`)),
                        type: RecordWarningType.Warning,
                        inverted: true,
                    }),
                }),
                RecordSettings.create({
                    id: 'debtor.address',
                    name: TranslatedString.create($t(`%Cn`)),
                    required: true,
                    type: RecordType.Address,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'member',
            name: TranslatedString.create($t(`%xv`)),
            description: TranslatedString.create($t(`%xw`)),
            records: [
                RecordSettings.create({
                    id: 'member.nationalRegisterNumber',
                    name: TranslatedString.create($t(`%wK`)),
                    required: false,
                    type: RecordType.Text,
                    warning: RecordWarning.create({
                        id: 'missing.member.nationalRegisterNumber',
                        text: TranslatedString.create($t(`%xx`)),
                        type: RecordWarningType.Warning,
                        inverted: true,
                    }),
                }),
                RecordSettings.create({
                    id: 'member.firstName',
                    name: TranslatedString.create($t(`%1MT`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'member.lastName',
                    name: TranslatedString.create($t(`%1MU`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'member.birthDay',
                    name: TranslatedString.create($t(`%17w`)),
                    required: true,
                    type: RecordType.Date,
                }),
                RecordSettings.create({
                    id: 'member.address',
                    name: TranslatedString.create($t(`%Cn`)),
                    required: true,
                    type: RecordType.Address,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'price',
            name: TranslatedString.create($t(`%1IP`)),
            description: TranslatedString.create($t(`%xy`)),
            records: [
                RecordSettings.create({
                    id: 'registration.price',
                    name: TranslatedString.create($t(`%1IP`)),
                    required: true,
                    type: RecordType.Price,
                    warning: RecordWarning.create({
                        id: 'missing.registration.price',
                        text: TranslatedString.create($t(`%xz`)),
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
            name: TranslatedString.create($t(`%y0`)),
            description: TranslatedString.create($t(`%y1`)),
            records: [
                RecordSettings.create({
                    id: 'confirmation',
                    name: TranslatedString.create($t(`%y2`)),
                    label: TranslatedString.create($t(`%y3`)),
                    required: true,
                    type: RecordType.Checkbox,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'additional-belcotax',
            name: TranslatedString.create($t(`%y4`)),
            description: TranslatedString.create($t(`%y5`)),
            records: [
                RecordSettings.create({
                    id: 'organization.contactName',
                    name: TranslatedString.create($t(`%y6`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'organization.phone',
                    name: TranslatedString.create($t(`%wD`)),
                    required: true,
                    type: RecordType.Phone,
                }),
                RecordSettings.create({
                    id: 'organization.email',
                    name: TranslatedString.create($t(`%1FK`)),
                    required: true,
                    type: RecordType.Email,
                    description: TranslatedString.create($t(`%y7`)),
                }),
                RecordSettings.create({
                    id: 'organization.companyNumber',
                    name: TranslatedString.create($t(`%y8`)),
                    required: true,
                    type: RecordType.Text,
                    description: TranslatedString.create($t(`%y9`)),
                }),
            ],
        }),
    ],
    xmlExportDescription: $t(`%yA`),
});
