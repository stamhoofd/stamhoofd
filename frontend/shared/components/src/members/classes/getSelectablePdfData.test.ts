import { ContextPermissions } from '@stamhoofd/frontend-session/ContextPermissions';
import type { PlatformMember } from '@stamhoofd/structures';
import { JudicialRecordHelper, JudicialRecordStatus, MemberDetails, MemberResponsibility, MemberResponsibilityRecord, MembersBlob, MemberWithRegistrationsBlob, Organization, OrganizationPrivateMetaData, Platform, PlatformConfig, PlatformFamily } from '@stamhoofd/structures';
import { describe, expect, it } from 'vitest';
import { getSelectablePdfData } from './getSelectablePdfData';

describe('getSelectablePdfData', () => {
    const createResponsibility = (judicialRecordMinimumAge: number | null) => MemberResponsibility.create({ name: 'Leiding', judicialRecordMinimumAge });

    function createContext({ platformAge, organizationAge }: { platformAge?: number | null; organizationAge?: number | null }) {
        const platform = Platform.create({
            config: PlatformConfig.create({ responsibilities: platformAge === undefined ? [] : [createResponsibility(platformAge)] }),
        });
        const organization = organizationAge === undefined
            ? null
            : Organization.create({
                    privateMeta: OrganizationPrivateMetaData.create({ responsibilities: [createResponsibility(organizationAge)] }),
                });

        return { platform, organization, auth: new ContextPermissions(null, organization, platform) };
    }

    function getDataIds(options: { platformAge?: number | null; organizationAge?: number | null }) {
        return getSelectablePdfData(createContext(options)).map(data => data.id);
    }

    it('offers the judicial record status when a responsibility asks for an extract', () => {
        expect(getDataIds({ platformAge: 18 })).toContain('judicialRecordStatus');
        expect(getDataIds({ organizationAge: 18 })).toContain('judicialRecordStatus');
    });

    it('leaves out the judicial record status when no responsibility asks for an extract', () => {
        expect(getDataIds({ platformAge: null, organizationAge: null })).not.toContain('judicialRecordStatus');
        expect(getDataIds({})).not.toContain('judicialRecordStatus');
    });

    it('exports the name of the status', () => {
        const responsibility = createResponsibility(18);
        const platform = Platform.create({ config: PlatformConfig.create({ responsibilities: [responsibility] }) });
        const organization = Organization.create({});

        const memberBlob = MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({ firstName: 'John', lastName: 'Doe', birthDay: new Date('1990-01-01T00:00:00Z') }),
        });
        memberBlob.responsibilities = [MemberResponsibilityRecord.create({
            memberId: memberBlob.id,
            organizationId: organization.id,
            responsibilityId: responsibility.id,
            startDate: new Date('2025-09-01T00:00:00Z'),
        })];

        const member: PlatformMember = PlatformFamily.create(MembersBlob.create({
            organizations: [organization],
            members: [memberBlob],
        }), { platform, contextOrganization: organization }).members[0];

        const data = getSelectablePdfData({ platform, organization, auth: new ContextPermissions(null, organization, platform) })
            .find(d => d.id === 'judicialRecordStatus');

        expect(data?.getValue(member)).toBe(JudicialRecordHelper.getStatusName(JudicialRecordStatus.Required));
    });
});
