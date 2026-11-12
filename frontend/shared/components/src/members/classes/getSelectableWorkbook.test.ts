import { ContextPermissions } from '@stamhoofd/frontend-session/ContextPermissions';
import { MemberResponsibility, Organization, OrganizationPrivateMetaData, Platform, PlatformConfig } from '@stamhoofd/structures';
import { describe, expect, it } from 'vitest';
import { getSelectableColumns } from './getSelectableWorkbook';

describe('getSelectableColumns', () => {
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

        return getSelectableColumns({
            platform,
            organization,
            auth: new ContextPermissions(null, organization, platform),
        }).map(column => column.id);
    }

    it('offers the judicial record status when a platform responsibility asks for an extract', () => {
        expect(getColumnIds({ platformAge: 18 })).toContain('judicialRecordStatus');
    });

    it('offers the judicial record status when a responsibility of the organization asks for an extract', () => {
        expect(getColumnIds({ organizationAge: 18 })).toContain('judicialRecordStatus');
    });

    it('leaves out the judicial record status when no responsibility asks for an extract', () => {
        expect(getColumnIds({ platformAge: null, organizationAge: null })).not.toContain('judicialRecordStatus');
        expect(getColumnIds({})).not.toContain('judicialRecordStatus');
    });
});
