import { Migration } from '@simonbackx/simple-database';
import { Group, Organization, Webshop } from '@stamhoofd/models';
import type { GroupCategory, PermissionRole } from '@stamhoofd/structures';
import { AccessRight, PermissionLevel, PermissionsResourceType, ResourcePermissions } from '@stamhoofd/structures';
import { SeedTools } from '../helpers/SeedTools.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName.toLowerCase() !== 'stamhoofd') {
        console.log('skipped for platform (only runs for Stamhoofd): ' + STAMHOOFD.platformName);
        return;
    }

    const dryRun = false;
    await start(dryRun);

    if (dryRun) {
        throw new Error('Migration did not finish because of dryRun');
    }
});

async function start(dryRun: boolean) {
    await SeedTools.loop({
        query: Organization.select(),
        batchSize: 50,
        useTransactionPerBatch: true,
        action: async (organization: Organization) => {
            const groups: Group[] = await Group.select()
                .where('organizationId', organization.id)
                // only for current period
                .where('periodId', organization.periodId)
                .fetch();

            if (groups.length === 0) {
                return;
            }

            // handle group permissions
            for (const group of groups) {
                const groupPermissions = group.privateSettings.permissions;
                if (!groupPermissions) {
                    continue;
                }

                for (const role of groupPermissions.read) {
                    handlePermissionRoleForGroup(organization, group, role, PermissionLevel.Read);
                }

                for (const role of groupPermissions.write) {
                    handlePermissionRoleForGroup(organization, group, role, PermissionLevel.Write);
                }

                for (const role of groupPermissions.full) {
                    handlePermissionRoleForGroup(organization, group, role, PermissionLevel.Full);
                }
            }

            // handle group category permissions
            for (const oldCategory of organization.meta.categories) {
                const groupCategoryPermissions = oldCategory.settings.permissions;
                if (!groupCategoryPermissions) {
                    continue;
                }

                for (const createPermission of groupCategoryPermissions.create) {
                    handleCreateForGroupCategory(organization, oldCategory, createPermission);
                }

                const groupPermissions = groupCategoryPermissions.groupPermissions;

                if (groupPermissions) {
                    for (const role of groupPermissions.read) {
                        handlePermissionRoleForGroupCategory(organization, oldCategory, role, PermissionLevel.Read);
                    }

                    for (const role of groupPermissions.write) {
                        handlePermissionRoleForGroupCategory(organization, oldCategory, role, PermissionLevel.Write);
                    }

                    for (const role of groupPermissions.full) {
                        handlePermissionRoleForGroupCategory(organization, oldCategory, role, PermissionLevel.Full);
                    }
                }
            }

            // handle webshops
            const webshops: Webshop[] = await Webshop.select()
                .where('organizationId', organization.id)
                .fetch();

            for (const webshop of webshops) {
                const scanPermissions = webshop.privateMeta.scanPermissions;

                // scan permissions are always write
                if (scanPermissions) {
                    for (const role of scanPermissions.write) {
                        handleScanForWebshop(organization, webshop, role);
                    }

                    if (scanPermissions.read.length) {
                        throw new Error('Not expected to have read permissions on webshop scanPermissions, webshop: ' + webshop.id);
                    }

                    if (scanPermissions.full.length) {
                        throw new Error('Not expected to have full permissions on webshop scanPermissions, webshop: ' + webshop.id);
                    }
                }

                const permissions = webshop.privateMeta.permissions;
                if (permissions) {
                    for (const role of permissions.read) {
                        handlePermissionRoleForWebshop(organization, webshop, role, PermissionLevel.Read);
                    }

                    for (const role of permissions.write) {
                        handlePermissionRoleForWebshop(organization, webshop, role, PermissionLevel.Write);
                    }

                    for (const role of permissions.full) {
                        handlePermissionRoleForWebshop(organization, webshop, role, PermissionLevel.Full);
                    }
                }
            }

            if (!dryRun) {
                await organization.save();
            }
        },

    });
}

// groups
function handlePermissionRoleForGroup(organization: Organization, group: Group, permissionRole: PermissionRole, level: PermissionLevel) {
    const organizationRole = getOrganizationRole(organization, permissionRole);
    if (!organizationRole) {
        return;
    }

    let allGroupPermissions = organizationRole.resources.get(PermissionsResourceType.Groups);

    if (!allGroupPermissions) {
        allGroupPermissions = new Map<string, ResourcePermissions>();
        organizationRole.resources.set(PermissionsResourceType.Groups, allGroupPermissions);
    }

    const specificGroupPermissions: ResourcePermissions | undefined = allGroupPermissions.get(group.id);

    const convertedRessourcePermissions = ResourcePermissions.create({ level, resourceName: group.settings.name.toString() });

    if (!specificGroupPermissions) {
        allGroupPermissions.set(group.id, convertedRessourcePermissions);
        return;
    }

    specificGroupPermissions.merge(convertedRessourcePermissions);
    return;
}

// categories
function handleCreateForGroupCategory(organization: Organization, oldCategory: GroupCategory, permissionRole: PermissionRole) {
    const organizationRole = getOrganizationRole(organization, permissionRole);
    if (!organizationRole) {
        return;
    }

    let allGroupCategoryPermissions = organizationRole.resources.get(PermissionsResourceType.GroupCategories);

    if (!allGroupCategoryPermissions) {
        allGroupCategoryPermissions = new Map<string, ResourcePermissions>();
        organizationRole.resources.set(PermissionsResourceType.GroupCategories, allGroupCategoryPermissions);
    }

    const specificGroupCategoryPermissions: ResourcePermissions | undefined = allGroupCategoryPermissions.get(oldCategory.id);

    if (specificGroupCategoryPermissions) {
        if (!specificGroupCategoryPermissions.accessRights.includes(AccessRight.OrganizationCreateGroups)) {
            specificGroupCategoryPermissions.accessRights.push(AccessRight.OrganizationCreateGroups);
        }
        return;
    }

    allGroupCategoryPermissions.set(oldCategory.id, ResourcePermissions.create({ resourceName: oldCategory.settings.name, accessRights: [AccessRight.OrganizationCreateGroups] }));
}

function handlePermissionRoleForGroupCategory(organization: Organization, oldCategory: GroupCategory, permissionRole: PermissionRole, level: PermissionLevel) {
    const organizationRole = getOrganizationRole(organization, permissionRole);
    if (!organizationRole) {
        return;
    }

    let allGroupCategoryPermissions = organizationRole.resources.get(PermissionsResourceType.GroupCategories);

    if (!allGroupCategoryPermissions) {
        allGroupCategoryPermissions = new Map<string, ResourcePermissions>();
        organizationRole.resources.set(PermissionsResourceType.GroupCategories, allGroupCategoryPermissions);
    }

    const specificGroupCategoryPermissions: ResourcePermissions | undefined = allGroupCategoryPermissions.get(oldCategory.id);

    const convertedRessourcePermissions = ResourcePermissions.create({ level, resourceName: oldCategory.settings.name });

    if (!specificGroupCategoryPermissions) {
        allGroupCategoryPermissions.set(oldCategory.id, convertedRessourcePermissions);
        return;
    }

    specificGroupCategoryPermissions.merge(convertedRessourcePermissions);
    return;
}

// webshops
function handleScanForWebshop(organization: Organization, webshop: Webshop, permissionRole: PermissionRole) {
    const organizationRole = getOrganizationRole(organization, permissionRole);
    if (!organizationRole) {
        return;
    }

    let allWebshopPermissions = organizationRole.resources.get(PermissionsResourceType.Webshops);

    if (!allWebshopPermissions) {
        allWebshopPermissions = new Map<string, ResourcePermissions>();
        organizationRole.resources.set(PermissionsResourceType.Webshops, allWebshopPermissions);
    }

    const specificWebshopPermissions: ResourcePermissions | undefined = allWebshopPermissions.get(webshop.id);

    if (specificWebshopPermissions) {
        if (!specificWebshopPermissions.accessRights.includes(AccessRight.WebshopScanTickets)) {
            specificWebshopPermissions.accessRights.push(AccessRight.WebshopScanTickets);
        }
        return;
    }

    allWebshopPermissions.set(webshop.id, ResourcePermissions.create({ resourceName: webshop.meta.name, accessRights: [AccessRight.WebshopScanTickets] }));
}

function handlePermissionRoleForWebshop(organization: Organization, webshop: Webshop, permissionRole: PermissionRole, level: PermissionLevel) {
    const organizationRole = getOrganizationRole(organization, permissionRole);
    if (!organizationRole) {
        return;
    }

    let allWebshopPermissions = organizationRole.resources.get(PermissionsResourceType.Webshops);

    if (!allWebshopPermissions) {
        allWebshopPermissions = new Map<string, ResourcePermissions>();
        organizationRole.resources.set(PermissionsResourceType.Webshops, allWebshopPermissions);
    }

    const specificWebshopPermissions: ResourcePermissions | undefined = allWebshopPermissions.get(webshop.id);

    const convertedRessourcePermissions = ResourcePermissions.create({ level, resourceName: webshop.meta.name });

    if (!specificWebshopPermissions) {
        allWebshopPermissions.set(webshop.id, convertedRessourcePermissions);
        return;
    }

    specificWebshopPermissions.merge(convertedRessourcePermissions);
    return;
}

function getOrganizationRole(organization: Organization, permissionRole: PermissionRole) {
    const organizationRole = organization.privateMeta.roles.find(r => r.id === permissionRole.id);
    if (!organizationRole) {
        console.error(`Could not find role for organization ${organization.id} (${organization.name}) and role ${permissionRole.id} (${permissionRole.name})`);
        return;
    }

    // console.error(`Did find role for organization ${organization.id} (${organization.name}) and role ${permissionRole.id} (${permissionRole.name})`);
    return organizationRole;
}
