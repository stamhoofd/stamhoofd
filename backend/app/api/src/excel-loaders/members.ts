import { MembersExportDictionary } from '@stamhoofd/data-export';
import { XlsxBuiltInNumberFormat, XlsxTransformerColumn, XlsxTransformerSheet } from '@stamhoofd/excel-writer';
import { Platform } from '@stamhoofd/models';
import { ExcelExportType, LimitedFilteredRequest, PlatformFamily, PlatformMember, UnencodeablePaginatedResponse } from '@stamhoofd/structures';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint';
import { GetMembersEndpoint } from '../endpoints/global/members/GetMembersEndpoint';
import { AuthenticatedStructures } from '../helpers/AuthenticatedStructures';
import { Context } from '../helpers/Context';

const dictionary = new MembersExportDictionary({
    getOrganizationId: () => Context.organization?.id,
});

export const baseMemberColumns: XlsxTransformerColumn<PlatformMember>[] = [
    ...dictionary.defineConcreteExcelColumns<MembersExportDictionary>({
        'memberNumber': {
            width: 20,
        }, 'firstName': {
            width: 20,
        },
        'lastName': {
            width: 20,
        },
        'birthDay': {
            width: 20,
            getValue: () => ({
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateSlash,
                    },
                },
            }),
        },
        'age': {
            width: 20,
        },
        'gender': {
            width: 20,
        },
        'phone': {
            width: 20,
        },
        'email': {
            width: 40,
        },
        'securityCode': {
            width: 20,
        },
        'uitpasNumber': {
            width: 20,
        },
        'requiresFinancialSupport': {
            width: 20,
        },
        'notes': {
            width: 20,
        },
        'organization': {
            width: 40,
        },
        'uri': {
            width: 30,
        },
        'group': {
            width: 40,
        },
        'defaultAgeGroup': {
            width: 40,
        },
        'nationalRegisterNumber': {
            width: 30,
        },
        'unverifiedPhones': {
            width: 20,
        },
        'unverifiedEmails': {
            width: 20,
        },
        'unverifiedAddresses': {
            width: 20,
        },
        'parent.type': {
            width: 20,
        },
        'parent.firstName': {
            width: 20,
        },
        'parent.lastName': {
            width: 20,
        },
        'parent.phone': {
            width: 20,
        },
        'parent.email': {
            width: 20,
        },
        'parent.nationalRegisterNumber': {
            width: 20,
        },
    }),
    // todo: dynamic records
    ...dictionary.defineMatchExcelColumn<MembersExportDictionary, 'address'>(
        'address',
        {
            street: {
                width: 40,
            },
            number: {
                width: 20,
            },
            postalCode: {
                width: 20,
            },
            city: {
                width: 20,
            },
            country: {
                width: 20,
            },
        },
    ),
    ...dictionary.defineMatchExcelColumn<MembersExportDictionary, 'parent.address'>(
        'parent.address',
        {
            street: {
                width: 40,
            },
            number: {
                width: 20,
            },
            postalCode: {
                width: 20,
            },
            city: {
                width: 20,
            },
            country: {
                width: 20,
            },
        },
    ),
    ...dictionary.defineMatchExcelColumn<MembersExportDictionary, 'unverifiedAddresses'>(
        'unverifiedAddresses',
        {
            street: {
                width: 40,
            },
            number: {
                width: 20,
            },
            postalCode: {
                width: 20,
            },
            city: {
                width: 20,
            },
            country: {
                width: 20,
            },
        },
    ),
];

//     // Dynamic records
//     XlsxTransformerColumnHelper.createRecordAnswersColumns({
//         matchId: 'recordAnswers',
//         getRecordAnswers: ({ patchedMember: object }: PlatformMember) => object.details.recordAnswers,
//         getRecordCategories: () => {
//             const platform = PlatformStruct.shared;
//             const organization = Context.organization;

//             return [
//                 ...(organization?.meta.recordsConfiguration.recordCategories ?? []),
//                 ...platform.config.recordsConfiguration.recordCategories,
//             ];
//         },
//     }),
// ];

// Assign to a typed variable to assure we have correct type checking in place
const sheet: XlsxTransformerSheet<PlatformMember, PlatformMember> = {
    id: 'members',
    name: $t(`fb35c140-e936-4e91-aa92-ef4dfc59fb51`),
    columns: [
        {
            id: 'id',
            name: $t(`29360811-3663-496c-8d8f-c9fdf9467a74`),
            width: 40,
            getValue: ({ patchedMember: object }: PlatformMember) => ({
                value: object.id,
            }),
        },

        ...baseMemberColumns,

        // Registration records
        {
            match(id) {
                if (id.startsWith('groups.')) {
                    const splitted = id.split('.');
                    if (splitted.length < 3) {
                        return;
                    }

                    const groupId = splitted[1];
                    const recordName = splitted[2];

                    function getRegistration(object: PlatformMember) {
                        return object.filterRegistrations({ groupIds: [groupId] })[0] ?? null;
                    }

                    if (recordName === 'price') {
                        // Tarief
                        return [
                            {
                                id: `groups.${groupId}.${recordName}`,
                                name: $t(`dcc53f25-f0e9-4e3e-9f4f-e8cfa4e88755`),
                                width: 30,
                                getValue: (member: PlatformMember) => {
                                    const registration = getRegistration(member);
                                    if (!registration) {
                                        return {
                                            value: '',
                                        };
                                    }

                                    return {
                                        value: registration.groupPrice.name.toString(),
                                    };
                                },
                            },
                        ];
                    }

                    if (recordName === 'optionMenu') {
                        if (splitted.length < 4) {
                            return;
                        }

                        const menuId = splitted[3];

                        if (splitted.length > 4) {
                            const optionId = splitted[4];
                            const returnAmount = splitted.length > 5 && splitted[5] === 'amount';

                            // Option menu
                            return [
                                {
                                    id: `groups.${groupId}.${recordName}.${menuId}.${optionId}${returnAmount ? '.amount' : ''}`,
                                    name: $t(`d89d7fcd-ecf3-40a2-afb6-f51c3f6c9bc6`),
                                    width: 30,
                                    getValue: (member: PlatformMember) => {
                                        const registration = getRegistration(member);
                                        if (!registration) {
                                            return {
                                                value: '',
                                            };
                                        }
                                        const options = registration.options.filter(o => o.optionMenu.id === menuId && o.option.id === optionId);

                                        if (!options.length) {
                                            return {
                                                value: '',
                                            };
                                        }

                                        return {
                                            style: options.length === 1 && returnAmount
                                                ? {
                                                        numberFormat: {
                                                            id: XlsxBuiltInNumberFormat.Number,
                                                        },
                                                    }
                                                : {},
                                            value: options.length === 1 && returnAmount ? options[0].amount : options.map(option => returnAmount ? option.amount : option).join(', '),
                                        };
                                    },
                                },
                            ];
                        }

                        // Option menu
                        return [
                            {
                                id: `groups.${groupId}.${recordName}.${menuId}`,
                                name: $t(`99e37a95-6a68-4921-a8db-08fb136f87dd`),
                                width: 30,
                                getValue: (member: PlatformMember) => {
                                    const registration = getRegistration(member);
                                    if (!registration) {
                                        return {
                                            value: '',
                                        };
                                    }
                                    const options = registration.options.filter(o => o.optionMenu.id === menuId);

                                    if (!options.length) {
                                        return {
                                            value: '',
                                        };
                                    }

                                    return {
                                        value: options.map(option => (option.amount > 1 ? `${option.amount}x ` : '') + option.option.name).join(', '),
                                    };
                                },
                            },
                        ];
                    }

                    if (recordName === 'recordAnswers') {
                        if (splitted.length < 4) {
                            return;
                        }

                        const recordId = splitted[3];
                        return [
                            {
                                id: `groups.${groupId}.${recordName}.${recordId}`,
                                name: 'Vraag',
                                width: 35,
                                getValue: (member: PlatformMember) => {
                                    const registration = getRegistration(member);
                                    if (!registration) {
                                        return {
                                            value: '',
                                        };
                                    }

                                    return {
                                        value: registration.recordAnswers.get(recordId)?.excelValues[0]?.value ?? '',
                                    };
                                },
                            },
                        ];
                    }

                    return;
                }
            },
        },
    ],
};

ExportToExcelEndpoint.loaders.set(ExcelExportType.Members, {
    fetch: async (query: LimitedFilteredRequest) => {
        const result = await GetMembersEndpoint.buildData(query);

        return new UnencodeablePaginatedResponse({
            results: PlatformFamily.createSingles(result.results, {
                contextOrganization: Context.organization ? (await AuthenticatedStructures.organization(Context.organization)) : null,
                platform: await Platform.getSharedStruct(),
            }),
            next: result.next,
        });
    },
    sheets: [
        sheet,
    ],
});
