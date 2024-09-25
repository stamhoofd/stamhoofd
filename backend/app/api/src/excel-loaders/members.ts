import { XlsxBuiltInNumberFormat } from '@stamhoofd/excel-writer';
import { Platform } from '@stamhoofd/models';
import { ExcelExportType, Gender, GroupType, LimitedFilteredRequest, MemberWithRegistrationsBlob, PlatformFamily, PlatformMember, UnencodeablePaginatedResponse, Platform as PlatformStruct } from '@stamhoofd/structures';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint';
import { GetMembersEndpoint } from '../endpoints/global/members/GetMembersEndpoint';
import { Context } from '../helpers/Context';
import { XlsxTransformerColumnHelper } from '../helpers/xlsxAddressTransformerColumnFactory';
import { Formatter } from '@stamhoofd/utility';
import { AuthenticatedStructures } from '../helpers/AuthenticatedStructures';

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
        {
            id: 'members',
            name: 'Leden',
            columns: [
                {
                    id: 'id',
                    name: 'ID',
                    width: 20,
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
                    width: 20,
                    getValue: ({ patchedMember: object }: PlatformMember) => ({
                        value: object.details.email,
                    }),
                },
                XlsxTransformerColumnHelper.createAddressColumns<PlatformMember>({
                    matchId: 'address',
                    identifier: 'Adres',
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
                ...XlsxTransformerColumnHelper.createColumnsForAddresses<MemberWithRegistrationsBlob>({
                    matchIdStart: 'unverifiedAddresses',
                    identifier: 'Niet-geverifieerd adres',
                    getAddresses: object => object.details.unverifiedAddresses,
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
                {
                    match(id) {
                        if (id.startsWith('recordAnswers.')) {
                            const platform = PlatformStruct.shared;
                            const organization = Context.organization;

                            const recordSettings = [
                                ...(organization?.meta.recordsConfiguration.recordCategories.flatMap(category => category.getAllRecords()) ?? []),
                                ...platform.config.recordsConfiguration.recordCategories.flatMap(category => category.getAllRecords()),
                            ];

                            const recordSettingId = id.split('.')[1];
                            console.log('recordSettingId', recordSettingId);
                            const recordSetting = recordSettings.find(r => r.id === recordSettingId);

                            if (!recordSetting) {
                                // Will throw a proper error itself
                                console.log('recordSetting not found', recordSettings);
                                return;
                            }

                            const columns = recordSetting.excelColumns;

                            return columns.map((columnName, index) => {
                                return {
                                    id: `recordAnswers.${recordSettingId}.${index}`,
                                    name: columnName,
                                    width: 20,
                                    getValue: ({ patchedMember: object }: PlatformMember) => ({
                                        value: object.details.recordAnswers.get(recordSettingId)?.excelValues[index]?.value ?? '',
                                    }),
                                };
                            });
                        }
                    },
                },
            ],
        },
    ],
});

function formatGender(gender: Gender) {
    switch (gender) {
        case Gender.Male: return 'Man';
        case Gender.Female: return 'Vrouw';
        default: return 'Andere';
    }
}
