import type { Group, GroupCategoryTree, Organization, Platform } from '@stamhoofd/structures';

/**
 * Title of a member or registration export, also used as its file name, e.g. "Startavond 2025 - Leden".
 * An export of a single member is named after that member.
 */
export function getMembersExportTitle({ organizations, platform, categories, groups, includeOrganizationName, suffix, singleMemberName }: {
    organizations: Organization[];
    platform: Platform;
    categories: GroupCategoryTree[];
    groups: Group[];
    includeOrganizationName: boolean;
    suffix: string;
    singleMemberName?: string | null;
}): string {
    if (singleMemberName) {
        return singleMemberName;
    }

    const organization = organizations.length === 1 ? organizations[0] : null;
    const parts = [
        organization && includeOrganizationName ? organization.name : null,
        organization && organization.period.period.id !== platform.period.id ? organization.period.period.name : null,
        categories.length === 1
            ? categories[0].settings.name
            : (groups.length === 1 ? groups[0].settings.name : null),
        suffix,
    ];

    return parts.filter(Boolean).join(' - ');
}
