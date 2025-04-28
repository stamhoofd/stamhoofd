import { DocumentTemplateDefinition, RecordCategory, RecordSettings, RecordType, ResolutionFit, ResolutionRequest, TranslatedString } from '@stamhoofd/structures';

export const participation = DocumentTemplateDefinition.create({
    type: 'participation',
    name: $t(`c2fe9ab5-f728-4898-a36c-18ba68ea7057`),
    allowChangingMinPricePaid: true,
    defaultMinPricePaid: 1,
    fieldCategories: [
        RecordCategory.create({
            id: 'organization',
            name: TranslatedString.create($t(`50ebabe0-8162-486d-b32a-9ef3016256fb`)),
            description: TranslatedString.create($t(`6efffec1-322e-479d-b411-abbcbc4daf09`)),
            records: [
                RecordSettings.create({
                    id: 'organization.name',
                    name: TranslatedString.create($t(`522fb6c5-6d4d-4d9c-94b7-3e282fb0ea1f`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'organization.companyNumber',
                    name: TranslatedString.create($t(`65fd44a4-cc92-49e7-8b44-91a75d601a7f`)),
                    required: false,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'organization.address',
                    name: TranslatedString.create($t(`2f10996e-ea97-4345-b997-c93198c7d67f`)),
                    required: true,
                    type: RecordType.Address,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'extra-info',
            name: TranslatedString.create($t(`ad7065f4-968e-4426-a21a-64425598227f`)),
            description: TranslatedString.create($t(`ec4ad440-8365-4f9e-b8f1-6fb4f50197b8`)),
            records: [
                RecordSettings.create({
                    id: 'comments',
                    name: TranslatedString.create($t(`2c27d8ac-0c46-4b61-94fe-0e12f5a253cd`)),
                    description: TranslatedString.create($t(`e6dff01b-1b53-4722-8791-e5a848ffa906`)),
                    required: false,
                    type: RecordType.Textarea,
                }),

                RecordSettings.create({
                    id: 'commentsFooter',
                    name: TranslatedString.create($t(`ea19c006-1755-4e2a-9dfa-447482e3db19`)),
                    description: TranslatedString.create($t(`f191c4af-b068-4987-aab4-5178603d2b69`)),
                    required: false,
                    type: RecordType.Textarea,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'signature',
            name: TranslatedString.create($t(`7fec542e-0f75-4dfe-be2f-29e1d3027373`)),
            description: TranslatedString.create($t(`77909625-47a0-4ef4-a059-1a8f77ee4add`)),
            records: [
                RecordSettings.create({
                    id: 'signature.name',
                    name: TranslatedString.create($t(`522fb6c5-6d4d-4d9c-94b7-3e282fb0ea1f`)),
                    required: false,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'signature.image',
                    name: TranslatedString.create($t(`9c50bba5-620b-4391-88a2-a69e9034cf00`)),
                    description: TranslatedString.create($t(`b36e52ad-a913-43ef-a36b-bda1ed04761e`)),
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
            name: TranslatedString.create($t(`0fd49a27-7db1-469c-9d9d-60a7283ed86c`)),
            description: TranslatedString.create($t(`25fe78a6-38fc-4ead-b19c-62bf131525d9`)),
            records: [
                RecordSettings.create({
                    id: 'registration.showGroup',
                    name: TranslatedString.create($t(`837fbd12-19ca-4e9e-af34-97c532a11ee4`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'registration.showDate',
                    name: TranslatedString.create($t(`28ae51dd-58a3-4c94-bf9b-38c464d5b8fe`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'enable[registration.price]',
                    name: TranslatedString.create($t(`273d798e-0e89-4cbe-9dfa-4d704db924da`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'registration.showPaidAt',
                    name: TranslatedString.create($t(`bef77bb4-89ee-4097-9215-6f5c91546f12`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'enable[member.birthDay]',
                    name: TranslatedString.create($t(`5ebb9959-713d-4142-8bcc-8a20f8772de8`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'enable[member.nationalRegisterNumber]',
                    name: TranslatedString.create($t(`573bb657-310f-4a8c-84ed-eee3be6db42d`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'enable[member.email]',
                    name: TranslatedString.create($t(`f6cc9f01-5347-446d-a2d7-78b840a647c1`)),
                    required: false,
                    type: RecordType.Checkbox,
                }),
                RecordSettings.create({
                    id: 'enable[member.address]',
                    name: TranslatedString.create($t(`cf817c09-d0c8-4237-adf7-8d16d6f96bf1`)),
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
            name: TranslatedString.create($t(`c3a8a598-5b30-4d37-bc99-9f3157b36246`)),
            records: [
                RecordSettings.create({
                    id: 'member.firstName',
                    name: TranslatedString.create($t(`efca0579-0543-4636-a996-384bc9f0527e`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'member.lastName',
                    name: TranslatedString.create($t(`4a5e438e-08a1-411e-9b66-410eea7ded73`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'member.birthDay',
                    name: TranslatedString.create($t(`7d7b5a21-105a-41a1-b511-8639b59024a4`)),
                    required: false,
                    type: RecordType.Date,
                }),
                RecordSettings.create({
                    id: 'member.address',
                    name: TranslatedString.create($t(`2f10996e-ea97-4345-b997-c93198c7d67f`)),
                    required: false,
                    type: RecordType.Address,
                }),
                RecordSettings.create({
                    id: 'member.nationalRegisterNumber',
                    name: TranslatedString.create($t(`00881b27-7501-4c56-98de-55618be2bf11`)),
                    required: false,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'member.email',
                    name: TranslatedString.create($t(`82f4b6ed-afee-4655-9f07-22802e0e7ad9`)),
                    required: false,
                    type: RecordType.Email,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'price',
            name: TranslatedString.create($t(`6f3104d4-9b8f-4946-8434-77202efae9f0`)),
            records: [
                RecordSettings.create({
                    id: 'registration.price',
                    name: TranslatedString.create($t(`6f3104d4-9b8f-4946-8434-77202efae9f0`)),
                    required: false,
                    type: RecordType.Price,
                }),
            ],
        }),
    ],
});
