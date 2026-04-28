import { DocumentTemplateDefinition, RecordCategory, RecordSettings, RecordType, ResolutionFit, ResolutionRequest, TranslatedString } from '@stamhoofd/structures';

export const participation = DocumentTemplateDefinition.create({
    type: 'participation',
    name: $t(`%yB`),
    allowChangingMinPricePaid: true,
    defaultMinPricePaid: 1_00, // = 1 cent
    fieldCategories: [
        RecordCategory.create({
            id: 'organization',
            name: TranslatedString.create($t(`%1PI`)),
            description: TranslatedString.create($t(`%yC`)),
            records: [
                RecordSettings.create({
                    id: 'organization.name',
                    name: TranslatedString.create($t(`%1Os`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'organization.companyNumber',
                    name: TranslatedString.create($t(`%xZ`)),
                    required: false,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'organization.address',
                    name: TranslatedString.create($t(`%Cn`)),
                    required: true,
                    type: RecordType.Address,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'extra-info',
            name: TranslatedString.create($t(`%yD`)),
            description: TranslatedString.create($t(`%yE`)),
            records: [
                RecordSettings.create({
                    id: 'comments',
                    name: TranslatedString.create($t(`%yF`)),
                    description: TranslatedString.create($t(`%yG`)),
                    required: false,
                    type: RecordType.Textarea,
                }),

                RecordSettings.create({
                    id: 'commentsFooter',
                    name: TranslatedString.create($t(`%yH`)),
                    description: TranslatedString.create($t(`%yI`)),
                    required: false,
                    type: RecordType.Textarea,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'signature',
            name: TranslatedString.create($t(`%xo`)),
            description: TranslatedString.create($t(`%yJ`)),
            records: [
                RecordSettings.create({
                    id: 'signature.name',
                    name: TranslatedString.create($t(`%1Os`)),
                    required: false,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'signature.image',
                    name: TranslatedString.create($t(`%xr`)),
                    description: TranslatedString.create($t(`%xs`)),
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
            name: TranslatedString.create($t(`%yK`)),
            description: TranslatedString.create($t(`%yL`)),
            records: [
                RecordSettings.create({
                    id: 'registration.showGroup',
                    name: TranslatedString.create($t(`%yM`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'registration.showDate',
                    name: TranslatedString.create($t(`%yN`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'enable[registration.price]',
                    name: TranslatedString.create($t(`%yO`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'registration.showPaidAt',
                    name: TranslatedString.create($t(`%yP`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'enable[member.birthDay]',
                    name: TranslatedString.create($t(`%yQ`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'enable[member.nationalRegisterNumber]',
                    name: TranslatedString.create($t(`%yR`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'enable[member.email]',
                    name: TranslatedString.create($t(`%yS`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'enable[member.address]',
                    name: TranslatedString.create($t(`%yT`)),
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
            name: TranslatedString.create($t(`%xv`)),
            records: [
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
                    required: false,
                    type: RecordType.Date,
                }),
                RecordSettings.create({
                    id: 'member.address',
                    name: TranslatedString.create($t(`%Cn`)),
                    required: false,
                    type: RecordType.Address,
                }),
                RecordSettings.create({
                    id: 'member.nationalRegisterNumber',
                    name: TranslatedString.create($t(`%wK`)),
                    required: false,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'member.email',
                    name: TranslatedString.create($t(`%1FK`)),
                    required: false,
                    type: RecordType.Email,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'price',
            name: TranslatedString.create($t(`%1IP`)),
            records: [
                RecordSettings.create({
                    id: 'registration.price',
                    name: TranslatedString.create($t(`%1IP`)),
                    required: false,
                    type: RecordType.Price,
                }),
            ],
        }),
    ],
});
