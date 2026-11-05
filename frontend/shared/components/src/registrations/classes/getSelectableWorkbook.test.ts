import { ContextPermissions } from '@stamhoofd/frontend-session/ContextPermissions';
import { MemberResponsibility, Organization, OrganizationPrivateMetaData, Platform, PlatformConfig } from '@stamhoofd/structures';
import { describe, expect, it } from 'vitest';
import { getSelectableWorkbook } from './getSelectableWorkbook';

describe('getSelectableWorkbook', () => {
    const createResponsibility = (judicialRecordMinimumAge: number | null) => MemberResponsibility.create({ name: 'Leiding', judicialRecordMinimumAge });

    function getColumnIds({ platformAge, organizationAge }: { platformAge?: number | null; organizationAge?: number | null }) {
        const platform = Platform.create({
            config: PlatformConfig.create({ responsibilities: platformAge === undefined ? [] : [createResponsibility(platformAge)] }),
        });
        const organization = organizationAge === undefined
            ? null
            : Organization.create({
                    privateMeta: OrganizationPrivateMetaData.create({ responsibilities: [createResponsibility(organizationAge)] }),
                });

        const workbook = getSelectableWorkbook(platform, organization, [], new ContextPermissions(null, organization, platform));

        return workbook.sheets[0].columns.map(column => column.id);
    }

    it('offers the judicial record status of the member when a responsibility asks for an extract', () => {
        expect(getColumnIds({ platformAge: 18 })).toContain('member.judicialRecordStatus');
        expect(getColumnIds({ organizationAge: 18 })).toContain('member.judicialRecordStatus');
    });

    it('leaves out the judicial record status when no responsibility asks for an extract', () => {
        expect(getColumnIds({ platformAge: null, organizationAge: null })).not.toContain('member.judicialRecordStatus');
        expect(getColumnIds({})).not.toContain('member.judicialRecordStatus');
    });
});
