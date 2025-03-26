import { XlsxBuiltInNumberFormat, XlsxTransformerSheet } from '@stamhoofd/excel-writer';
import { Platform } from '@stamhoofd/models';
import { ExcelExportType, Gender, GroupType, LimitedFilteredRequest, PlatformFamily, PlatformMember, Platform as PlatformStruct, UnencodeablePaginatedResponse } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint';
import { GetMembersEndpoint } from '../endpoints/global/members/GetMembersEndpoint';
import { AuthenticatedStructures } from '../helpers/AuthenticatedStructures';
import { Context } from '../helpers/Context';
import { XlsxTransformerColumnHelper } from '../helpers/XlsxTransformerColumnHelper';

// Assign to a typed variable to assure we have correct type checking in place
const sheet: XlsxTransformerSheet<PlatformMember, PlatformMember> = {
    id: 'members',
    name: 'Leden',
    columns: [
        {
            id: 'id',
            name: 'ID',
            width: 40,
            getValue: ({ patchedMember: object }: PlatformMember) => ({
                value: object.id,
            }),
        },
        {
            id: 'memberNumber',
            name: 'Nummer',
            width: 20,
            getValue: ({ patchedMember: object }: PlatformMember) => ({
                value: object.details.memberNumber,
            }),
        },
        {
            id: 'firstName',
            name: 'Voornaam',
            width: 20,
            getValue: ({ patchedMember: object }: PlatformMember) => ({
                value: object.details.firstName,
            }),
        },
        {
            id: 'lastName',
            name: 'Achternaam',
            width: 20,
            getValue: ({ patchedMember: object }: PlatformMember) => ({
                value: object.details.lastName,
            }),
        },
        {
            id: 'birthDay',
            name: 'Geboortedatum',
            width: 20,
            getValue: ({ patchedMember: object }: PlatformMember) => ({
                value: object.details.birthDay,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateSlash,
                    },
                },
            }),
        },
        {
            id: 'age',
            name: 'Leeftijd',
            width: 20,
            getValue: ({ patchedMember: object }: PlatformMember) => ({
                value: object.details.age,
            }),
        },
        {
            id: 'gender',
            name: 'Geslacht',
            width: 20,
            getValue: ({ patchedMember: object }: PlatformMember) => {
                const gender = object.details.gender;

                return ({
                    value: formatGender(gender),
                });
            },
        },
        {
            id: 'phone',
            name: 'Telefoonnummer',
            width: 20,
            getValue: ({ patchedMember: object }: PlatformMember) => ({
                value: object.details.phone,
            }),
        },
        {
            id: 'email',
            name: 'E-mailadres',
            width: 40,
            getValue: ({ patchedMember: object }: PlatformMember) => ({
                value: object.details.email,
            }),
        },
        XlsxTransformerColumnHelper.createAddressColumns<PlatformMember>({
            matchId: 'address',
            getAddress: ({ patchedMember: object }: PlatformMember) => {
                // get member address if exists
                const memberAddress = object.details.address;
                if (memberAddress) {
                    return memberAddress;
                }

                // else get address of first parent with address
                for (const parent of object.details.parents) {
                    if (parent.address) {
                        return parent.address;
                    }
                }

                return null;
            },
        }),
        {
            id: 'securityCode',
            name: 'Beveiligingscode',
            width: 20,
            getValue: ({ patchedMember: object }: PlatformMember) => ({
                value: object.details.securityCode,
            }),
        },
        {
            id: 'uitpasNumber',
            name: 'UiTPAS-nummer',
            width: 20,
            getValue: ({ patchedMember: object }: PlatformMember) => ({
                value: object.details.uitpasNumber,
            }),
        },
        {
            id: 'requiresFinancialSupport',
            // todo: use correct term
            name: 'Financiële ondersteuning',
            width: 20,
            getValue: ({ patchedMember: object }: PlatformMember) => ({
                value: XlsxTransformerColumnHelper.formatBoolean(object.details.requiresFinancialSupport?.value),
            }),
        },
        {
            id: 'notes',
            name: 'Notities',
            width: 20,
            getValue: ({ patchedMember: object }: PlatformMember) => ({
                value: object.details.notes,
            }),
        },

        {
            id: 'organization',
            name: 'Groep',
            width: 40,
            getValue: (member: PlatformMember) => {
                const organizations = member.filterOrganizations({ currentPeriod: true, types: [GroupType.Membership] });
                const str = Formatter.joinLast(organizations.map(o => o.name).sort(), ', ', ' en ') || Context.i18n.$t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

                return {
                    value: str,
                };
            },
        },

        {
            id: 'uri',
            name: 'Groepsnummer',
            width: 30,
            getValue: (member: PlatformMember) => {
                const organizations = member.filterOrganizations({ currentPeriod: true, types: [GroupType.Membership] });
                const str = Formatter.joinLast(organizations.map(o => o.uri).sort(), ', ', ' en ') || Context.i18n.$t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

                return {
                    value: str,
                };
            },
        },

        {
            id: 'group',
            name: 'Leeftijdsgroep',
            width: 40,
            getValue: (member: PlatformMember) => {
                const groups = member.filterRegistrations({ currentPeriod: true, types: [GroupType.Membership], organizationId: Context.organization?.id });
                const str = Formatter.joinLast(Formatter.uniqueArray(groups.map(o => o.group.settings.name)).sort(), ', ', ' en ') || Context.i18n.$t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

                return {
                    value: str,
                };
            },
        },

        {
            id: 'defaultAgeGroup',
            name: 'Standaard leeftijdsgroep',
            width: 40,
            getValue: (member: PlatformMember) => {
                const groups = member.filterRegistrations({ currentPeriod: true, types: [GroupType.Membership], organizationId: Context.organization?.id });
                const defaultAgeGroupIds = Formatter.uniqueArray(groups.filter(o => o.group.defaultAgeGroupId));
                const defaultAgeGroups = defaultAgeGroupIds.map(o => PlatformStruct.shared.config.defaultAgeGroups.find(g => g.id === o.group.defaultAgeGroupId)?.name ?? 'verwijderde leeftijdsgroep');
                const str = Formatter.joinLast(Formatter.uniqueArray(defaultAgeGroups).sort(), ', ', ' en ') || Context.i18n.$t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

                return {
                    value: str,
                };
            },
        },
        {
            id: 'nationalRegisterNumber',
            name: 'Rijksregisternummer',
            width: 30,
            getValue: ({ patchedMember: object }: PlatformMember) => ({
                value: object.details.nationalRegisterNumber?.toString() ?? '',
            }),
        },

        ...XlsxTransformerColumnHelper.creatColumnsForParents(),

        // unverified data
        {
            id: 'unverifiedPhones',
            name: 'Niet-geverifieerde telefoonnummers',
            width: 20,
            getValue: ({ patchedMember: object }: PlatformMember) => ({
                value: object.details.unverifiedPhones.join(', '),
            }),
        },
        {
            id: 'unverifiedEmails',
            name: 'Niet-geverifieerde e-mailadressen',
            width: 20,
            getValue: ({ patchedMember: object }: PlatformMember) => ({
                value: object.details.unverifiedEmails.join(', '),
            }),
        },
        ...XlsxTransformerColumnHelper.createColumnsForAddresses<PlatformMember>({
            matchIdStart: 'unverifiedAddresses',
            getAddresses: object => object.patchedMember.details.unverifiedAddresses,
            limit: 2,
        }),
        {
            id: 'unverifiedAddresses',
            name: 'Niet-geverifieerde adressen',
            width: 20,
            getValue: ({ patchedMember: object }: PlatformMember) => ({
                value: object.details.unverifiedAddresses.map(a => a.toString()).join('; '),
            }),
        },

        // Dynamic records
        XlsxTransformerColumnHelper.createRecordAnswersColumns({
            matchId: 'recordAnswers',
            getRecordAnswers: ({ patchedMember: object }: PlatformMember) => object.details.recordAnswers,
            getRecordCategories: () => {
                const platform = PlatformStruct.shared;
                const organization = Context.organization;

                return [
                    ...(organization?.meta.recordsConfiguration.recordCategories ?? []),
                    ...platform.config.recordsConfiguration.recordCategories,
                ];
            },
        }),

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
                                name: 'Tarief',
                                width: 30,
                                getValue: (member: PlatformMember) => {
                                    const registration = getRegistration(member);
                                    if (!registration) {
                                        return {
                                            value: '',
                                        };
                                    }

                                    return {
                                        value: registration.groupPrice.name,
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
                                    name: 'Keuzemenu aantal',
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
                                name: 'Keuzemenu',
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

function formatGender(gender: Gender) {
    switch (gender) {
        case Gender.Male: return 'Man';
        case Gender.Female: return 'Vrouw';
        default: return 'Andere';
    }
}
