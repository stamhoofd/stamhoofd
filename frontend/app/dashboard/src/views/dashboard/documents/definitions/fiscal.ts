import { DocumentTemplateDefinition, PropertyFilter, RecordCategory, RecordChoice, RecordSettings, RecordType, RecordWarning, RecordWarningType, ResolutionFit, ResolutionRequest, TranslatedString } from '@stamhoofd/structures';

export const fiscal = DocumentTemplateDefinition.create({
    type: 'fiscal',
    name: $t(`2e2c43a8-3709-4947-83e0-3b0345cd7b44`),
    defaultMaxAge: 13,
    defaultMinPrice: 1_00, // = 1 cent
    fieldCategories: [
        RecordCategory.create({
            id: 'organization',
            name: TranslatedString.create($t(`50ebabe0-8162-486d-b32a-9ef3016256fb`)),
            description: TranslatedString.create($t(`2e5e2e62-1e0c-406d-96c9-f66e7c8e85bd`)),
            records: [
                RecordSettings.create({
                    id: 'organization.companyName',
                    name: TranslatedString.create($t(`522fb6c5-6d4d-4d9c-94b7-3e282fb0ea1f`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'organization.companyNumber',
                    name: TranslatedString.create($t(`da1e6727-6f1f-4713-93a5-2ec93092b9d0`)),
                    required: false,
                    type: RecordType.Text,
                    description: TranslatedString.create($t(`e13d9fec-ff5a-43e0-8cf4-4edc6e576d17`)),
                }),
                RecordSettings.create({
                    id: 'organization.companyAddress',
                    name: TranslatedString.create($t(`2f10996e-ea97-4345-b997-c93198c7d67f`)),
                    required: true,
                    type: RecordType.Address,
                }),
                RecordSettings.create({
                    id: 'certification.type',
                    name: TranslatedString.create($t(`7d6fa164-e3f8-4c09-9eb4-9d2828de7128`)),
                    description: TranslatedString.create($t(`50f3e5f0-8589-43cc-87ec-04c8ed628ed7`)),
                    required: true,
                    type: RecordType.ChooseOne,
                    choices: [
                        RecordChoice.create({
                            id: 'exception',
                            name: TranslatedString.create($t(`5b822590-b76a-43d4-a2c9-78825f98c4e7`)),
                            description: TranslatedString.create($t(`e089fe1b-ae31-4244-9d29-37f21655fe52`)),
                        }),
                        RecordChoice.create({
                            id: 'kind-en-gezin',
                            name: TranslatedString.create($t(`e201d9ff-c8bb-4b39-8e33-1fa3e8882248`)),
                            description: TranslatedString.create($t(`72d62e2a-b6e3-4d86-9d40-a316dd8386a1`)),
                        }),
                        RecordChoice.create({
                            id: 'authorities',
                            name: TranslatedString.create($t(`20a43c31-e394-4bb4-9b1f-8afd5d5268fa`)),
                            description: TranslatedString.create($t(`b80c6123-24fb-42fc-9770-b6c251951c58`)),
                        }),
                        RecordChoice.create({
                            id: 'foreign',
                            name: TranslatedString.create($t(`6c729f25-24a1-4795-9558-dcc478fdb44d`)),
                            description: TranslatedString.create($t(`2d8e8d29-9cb9-49a2-8824-5285dea824b7`)),
                        }),
                        RecordChoice.create({
                            id: 'schools',
                            name: TranslatedString.create($t(`60f135eb-adb3-4e1a-9ba2-7e6e084a83aa`)),
                            description: TranslatedString.create($t(`79c1d4a0-f5f3-465d-bf7b-a15b5f2a4bb4`)),
                        }),
                    ],
                }),
            ],
        }),
        RecordCategory.create({
            id: 'certification',
            name: TranslatedString.create($t(`4ce7c41a-f020-4949-a889-71549e0f6d0f`)),
            description: TranslatedString.create($t(`d6686410-12c2-4481-90e1-87e112e65043`)),
            records: [
                RecordSettings.create({
                    id: 'certification.name',
                    name: TranslatedString.create($t(`522fb6c5-6d4d-4d9c-94b7-3e282fb0ea1f`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'certification.companyNumber',
                    name: TranslatedString.create($t(`65fd44a4-cc92-49e7-8b44-91a75d601a7f`)),
                    required: false,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'certification.address',
                    name: TranslatedString.create($t(`2f10996e-ea97-4345-b997-c93198c7d67f`)),
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
            name: TranslatedString.create($t(`7fec542e-0f75-4dfe-be2f-29e1d3027373`)),
            description: TranslatedString.create($t(`dd431861-0d75-4c28-8a26-2140465e5556`)),
            records: [
                RecordSettings.create({
                    id: 'signature.name',
                    name: TranslatedString.create($t(`522fb6c5-6d4d-4d9c-94b7-3e282fb0ea1f`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'signature.capacity',
                    name: TranslatedString.create($t(`bb8c9f3b-3578-4662-b78f-1e0e92f90229`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'signature.image',
                    name: TranslatedString.create($t(`9c50bba5-620b-4391-88a2-a69e9034cf00`)),
                    description: TranslatedString.create($t(`b36e52ad-a913-43ef-a36b-bda1ed04761e`)),
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
            name: TranslatedString.create($t(`b9c7a57e-6dc1-48a2-bcba-a26c5f59555e`)),
            description: TranslatedString.create($t(`b1549fce-7655-4e22-9622-48eb70f35e52`)),
            records: [
                RecordSettings.create({
                    id: 'debtor.firstName',
                    name: TranslatedString.create($t(`efca0579-0543-4636-a996-384bc9f0527e`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'debtor.lastName',
                    name: TranslatedString.create($t(`4a5e438e-08a1-411e-9b66-410eea7ded73`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'debtor.nationalRegisterNumber',
                    name: TranslatedString.create($t(`00881b27-7501-4c56-98de-55618be2bf11`)),
                    required: false,
                    type: RecordType.Text,
                    warning: RecordWarning.create({
                        id: 'missing.debtor.nationalRegisterNumber',
                        text: TranslatedString.create($t(`d05b1cb9-e9cf-46e4-8b27-620b5562d30d`)),
                        type: RecordWarningType.Warning,
                        inverted: true,
                    }),
                }),
                RecordSettings.create({
                    id: 'debtor.address',
                    name: TranslatedString.create($t(`2f10996e-ea97-4345-b997-c93198c7d67f`)),
                    required: true,
                    type: RecordType.Address,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'member',
            name: TranslatedString.create($t(`c3a8a598-5b30-4d37-bc99-9f3157b36246`)),
            description: TranslatedString.create($t(`74941f69-d7cd-4003-bc5a-18d9b22e03ed`)),
            records: [
                RecordSettings.create({
                    id: 'member.nationalRegisterNumber',
                    name: TranslatedString.create($t(`00881b27-7501-4c56-98de-55618be2bf11`)),
                    required: false,
                    type: RecordType.Text,
                    warning: RecordWarning.create({
                        id: 'missing.member.nationalRegisterNumber',
                        text: TranslatedString.create($t(`3f5b1183-9db6-4bd4-9187-552b7ae4126c`)),
                        type: RecordWarningType.Warning,
                        inverted: true,
                    }),
                }),
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
                    required: true,
                    type: RecordType.Date,
                }),
                RecordSettings.create({
                    id: 'member.address',
                    name: TranslatedString.create($t(`2f10996e-ea97-4345-b997-c93198c7d67f`)),
                    required: true,
                    type: RecordType.Address,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'price',
            name: TranslatedString.create($t(`6f3104d4-9b8f-4946-8434-77202efae9f0`)),
            description: TranslatedString.create($t(`f3262b38-7afe-485b-bd97-fab76e825818`)),
            records: [
                RecordSettings.create({
                    id: 'registration.price',
                    name: TranslatedString.create($t(`6f3104d4-9b8f-4946-8434-77202efae9f0`)),
                    required: true,
                    type: RecordType.Price,
                    warning: RecordWarning.create({
                        id: 'missing.registration.price',
                        text: TranslatedString.create($t(`325dd5fa-871c-45b4-b732-5c5370c44b03`)),
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
            name: TranslatedString.create($t(`15bc5064-cd0d-4052-937b-cade8e19a858`)),
            description: TranslatedString.create($t(`2c9a2838-607e-4e19-87d9-ce5c1f46f7f0`)),
            records: [
                RecordSettings.create({
                    id: 'confirmation',
                    name: TranslatedString.create($t(`ae4c10ae-478e-48d9-b901-86f3f79df32e`)),
                    label: TranslatedString.create($t(`079e1823-91db-4ef4-ba7b-94218d6a980e`)),
                    required: true,
                    type: RecordType.Checkbox,
                }),
            ],
        }),
        RecordCategory.create({
            id: 'additional-belcotax',
            name: TranslatedString.create($t(`1b4a943c-e44d-4f9f-b5bd-08a485ef05d3`)),
            description: TranslatedString.create($t(`1e58daa1-b5dc-4e51-8c2c-5ce461963f61`)),
            records: [
                RecordSettings.create({
                    id: 'organization.contactName',
                    name: TranslatedString.create($t(`084a7b59-d7d6-4352-8fe7-8f9e98ba1483`)),
                    required: true,
                    type: RecordType.Text,
                }),
                RecordSettings.create({
                    id: 'organization.phone',
                    name: TranslatedString.create($t(`856aaa1c-bc62-4e45-9ae5-4c7e7dca23ab`)),
                    required: true,
                    type: RecordType.Phone,
                }),
                RecordSettings.create({
                    id: 'organization.email',
                    name: TranslatedString.create($t(`82f4b6ed-afee-4655-9f07-22802e0e7ad9`)),
                    required: true,
                    type: RecordType.Email,
                    description: TranslatedString.create($t(`73219854-e149-4797-bae0-de7340b6f304`)),
                }),
                RecordSettings.create({
                    id: 'organization.companyNumber',
                    name: TranslatedString.create($t(`da1e6727-6f1f-4713-93a5-2ec93092b9d0`)),
                    required: true,
                    type: RecordType.Text,
                    description: TranslatedString.create($t(`e13d9fec-ff5a-43e0-8cf4-4edc6e576d17`)),
                }),
            ],
        }),
    ],
    xmlExportDescription: $t(`bf58c9d8-b970-412f-bcf3-9fd2f037c4ff`),
});
