import { XlsxTransformerSheet } from '@stamhoofd/excel-writer';
import { Platform as PlatformStruct, ExcelExportType, LimitedFilteredRequest, Organization as OrganizationStruct, MemberResponsibilityRecord as MemberResponsibilityRecordStruct, PaginatedResponse, MemberWithRegistrationsBlob, Premise } from '@stamhoofd/structures';
import { GetOrganizationsEndpoint } from '../endpoints/admin/organizations/GetOrganizationsEndpoint';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint';
import { XlsxTransformerColumnHelper } from '../helpers/xlsxAddressTransformerColumnFactory';
import { Group, Member, MemberResponsibilityRecord } from '@stamhoofd/models';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { ArrayDecoder, field } from '@simonbackx/simple-encoding';
import { AuthenticatedStructures } from '../helpers/AuthenticatedStructures';

class MemberResponsibilityRecordWithMember extends MemberResponsibilityRecordStruct {
    @field({ decoder: MemberWithRegistrationsBlob })
    member: MemberWithRegistrationsBlob;
}

class OrganizationWithResponsibilities extends OrganizationStruct {
    @field({ decoder: new ArrayDecoder(MemberResponsibilityRecordWithMember) })
    responsibilities: MemberResponsibilityRecordWithMember[];
}

class MemberResponsibilityRecordWithMemberAndOrganization extends MemberResponsibilityRecordWithMember {
    @field({ decoder: OrganizationWithResponsibilities })
    organization: OrganizationWithResponsibilities;
}

type Object = OrganizationWithResponsibilities;

// Assign to a typed variable to assure we have correct type checking in place
const sheet: XlsxTransformerSheet<Object, Object> = {
    id: 'organizations',
    name: 'Groepen',
    columns: [
        {
            id: 'id',
            name: 'ID',
            width: 35,
            getValue: (object: Object) => ({
                value: object.id,
            }),
        },
        {
            id: 'uri',
            name: 'Groepsnummer',
            width: 20,
            getValue: (object: Object) => ({
                value: object.uri,
            }),
        },
        {
            id: 'name',
            name: 'Naam',
            width: 50,
            getValue: (object: Object) => ({
                value: object.name,
            }),
        },
        {
            id: 'tags',
            name: 'Tags',
            width: 50,
            getValue: (object: Object) => {
                const platform = PlatformStruct.shared;

                return {
                    value: object.meta.tags.map(tag => platform.config.tags.find(t => t.id === tag)?.name ?? 'Onbekend').join(', '),
                };
            },
        },
        XlsxTransformerColumnHelper.createAddressColumns<OrganizationStruct>({
            matchId: 'address',
            getAddress: object => object.address,
        }),
    ],
};

const responsibilities: XlsxTransformerSheet<Object, MemberResponsibilityRecordWithMemberAndOrganization> = {
    id: 'responsibilities',
    name: 'Functies',
    transform(organization) {
        return organization.responsibilities.map(r => MemberResponsibilityRecordWithMemberAndOrganization.create({
            ...r,
            organization,
        }));
    },
    columns: [
        {
            id: 'organization.id',
            name: 'ID',
            width: 35,
            getValue: (object: MemberResponsibilityRecordWithMemberAndOrganization) => ({
                value: object.organization.id,
            }),
        },
        {
            id: 'organization.uri',
            name: 'Groepsnummer',
            width: 20,
            getValue: (object: MemberResponsibilityRecordWithMemberAndOrganization) => ({
                value: object.organization.uri,
            }),
        },
        {
            id: 'organization.name',
            name: 'Groepsnaam',
            width: 50,
            getValue: (object: MemberResponsibilityRecordWithMemberAndOrganization) => ({
                value: object.organization.name,
            }),
        },
        {
            id: 'responsibility.name',
            name: 'Functie',
            width: 50,
            getValue: (object: MemberResponsibilityRecordWithMemberAndOrganization) => {
                const platform = PlatformStruct.shared;
                const responsibility = platform.config.responsibilities.find(r => r.id === object.responsibilityId) ?? object.organization.privateMeta?.responsibilities.find(r => r.id === object.responsibilityId);

                if (!responsibility) {
                    return {
                        value: 'Onbekende functie',
                    };
                }

                return {
                    value: responsibility.name + (responsibility.isGroupBased ? ' van ' + (object.group?.settings.name ?? 'Onbekende groep') : ''),
                };
            },
        },
        {
            id: 'responsibility.member.firstName',
            name: 'Voornaam',
            width: 30,
            getValue: (object: MemberResponsibilityRecordWithMemberAndOrganization) => ({
                value: object.member.firstName,
            }),
        },
        {
            id: 'responsibility.member.lastName',
            name: 'Achternaam',
            width: 30,
            getValue: (object: MemberResponsibilityRecordWithMemberAndOrganization) => ({
                value: object.member.details.lastName,
            }),
        },
        {
            id: 'responsibility.member.email',
            name: 'E-mailadres lid',
            width: 50,
            getValue: (object: MemberResponsibilityRecordWithMemberAndOrganization) => ({
                value: object.member.details.email,
            }),
        },
        XlsxTransformerColumnHelper.createAddressColumns<MemberResponsibilityRecordWithMemberAndOrganization>({
            matchId: 'responsibility.member.address',
            getAddress: object => object.member.details.address ?? object.member.details.parents[0]?.address ?? object.member.details.parents[1]?.address ?? null,
        }),
    ],
};

type PremiseWithOrganization = { organization: Object; premise: Premise };
const premises: XlsxTransformerSheet<Object, PremiseWithOrganization> = {
    id: 'premises',
    name: 'Lokalen',
    transform(organization) {
        return organization.privateMeta?.premises.map(r => ({
            organization,
            premise: r,
        })) ?? [];
    },
    columns: [
        {
            id: 'organization.id',
            name: 'ID',
            width: 35,
            getValue: (object: PremiseWithOrganization) => ({
                value: object.organization.id,
            }),
        },
        {
            id: 'organization.uri',
            name: 'Groepsnummer',
            width: 20,
            getValue: (object: PremiseWithOrganization) => ({
                value: object.organization.uri,
            }),
        },
        {
            id: 'organization.name',
            name: 'Groepsnaam',
            width: 50,
            getValue: (object: PremiseWithOrganization) => ({
                value: object.organization.name,
            }),
        },
        {
            id: 'premise.name',
            name: 'Naam',
            width: 20,
            getValue: (object: PremiseWithOrganization) => ({
                value: object.premise.name,
            }),
        },
        {
            id: 'premise.type',
            name: 'Type',
            width: 20,
            getValue: (object: PremiseWithOrganization) => {
                const ids = object.premise.premiseTypeIds;
                const platform = PlatformStruct.shared;
                return {
                    value: ids.map(id => platform.config.premiseTypes.find(t => t.id === id)?.name ?? 'Onbekend').join(', '),
                };
            },
        },
        XlsxTransformerColumnHelper.createAddressColumns<PremiseWithOrganization>({
            matchId: 'premise.address',
            getAddress: object => object.premise.address,
        }),
    ],
};

ExportToExcelEndpoint.loaders.set(ExcelExportType.Organizations, {
    fetch: async (query: LimitedFilteredRequest) => {
        const organizations = await GetOrganizationsEndpoint.buildData(query);

        // Now load all responsibilities with members with an active responsibility for theses organizations
        const organizationIds = organizations.results.map(o => o.id);
        const responsibilities = organizationIds.length
            ? await MemberResponsibilityRecord.select()
                .where('organizationId', organizationIds)
                .where('endDate', null)
                .fetch()
            : [];

        // Load groups and members
        const groupIds = Formatter.uniqueArray(responsibilities.map(o => o.groupId).filter(g => g !== null));
        const memberIds = Formatter.uniqueArray(responsibilities.map(o => o.memberId).filter(m => m !== null));

        const members = await Member.getBlobByIds(...memberIds);
        const groups = await Group.getByIDs(...groupIds);
        const memberStructs = await AuthenticatedStructures.members(members);
        const groupStructs = await AuthenticatedStructures.groups(groups);
        const platform = PlatformStruct.shared;

        const mappedOrganizations = organizations.results.map((o) => {
            const resp = responsibilities.filter(r => r.organizationId === o.id);

            const mappedResponsibilities = resp.map((r) => {
                const member = memberStructs.find(m => m.id === r.memberId);
                const group = groupStructs.find(g => g.id === r.groupId);

                return MemberResponsibilityRecordWithMember.create({
                    ...r,
                    member: member,
                    group: group ? group : null,
                });
            });

            // Sort responsibilites by index in platform config
            // and, if the same, sort by order of default age group id if it has a group
            mappedResponsibilities.sort((a, b) => {
                const aIndex = platform.config.responsibilities.findIndex(r => r.id === a.responsibilityId);
                const bIndex = platform.config.responsibilities.findIndex(r => r.id === b.responsibilityId);

                const groupAIndex = platform.config.defaultAgeGroups.findIndex(g => g.id === a.group?.defaultAgeGroupId);
                const groupBIndex = platform.config.defaultAgeGroups.findIndex(g => g.id === b.group?.defaultAgeGroupId);

                return Sorter.stack(
                    aIndex - bIndex,
                    groupAIndex - groupBIndex,
                );
            });

            return OrganizationWithResponsibilities.create({
                ...o,
                responsibilities: mappedResponsibilities,
            });
        });

        return new PaginatedResponse({
            results: mappedOrganizations,
            next: organizations.next,
        });
    },
    sheets: [
        sheet,
        responsibilities,
        premises,
    ],
});
