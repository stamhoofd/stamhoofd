import type { AppType, Organization, PlatformMember, RecordCategory } from '@stamhoofd/structures';

/** Platform admins see which organization owns a record category that is not theirs */
export function getRecordCategoryTitleSuffix({ member, category, app, organization }: { member: PlatformMember; category: RecordCategory; app: AppType | 'auto'; organization: Organization | null }): string {
    if (app === 'registration') {
        return '';
    }

    const owningOrganization = member.organizations.find(o => o.meta.recordsConfiguration.recordCategories.find(c => c.id === category.id));
    if (owningOrganization && (!organization || owningOrganization.id !== organization.id)) {
        return owningOrganization.name;
    }

    return '';
}
