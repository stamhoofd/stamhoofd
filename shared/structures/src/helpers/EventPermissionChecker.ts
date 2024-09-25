import { SimpleError } from "@simonbackx/simple-errors";
import { AccessRight } from "../AccessRight";
import { NamedObject } from "../Event";
import { PermissionsResourceType } from "../PermissionsResourceType";
import { Platform } from "../Platform";
import { OrganizationForPermissionCalculation, UserPermissions } from "../UserPermissions";

interface EventDataForPermission {
    organizationId: string | null;
    meta: {
        defaultAgeGroupIds: string[]|null,
        groups: NamedObject[]|null,
        organizationTagIds: string[]|null
    }
}

export class EventPermissionChecker {
    /**
     * Will throw error if not allowed to edit/add/delete this event
     * @param event 
     * @returns Organization if event for specific organization, else null
     * @throws error if not allowed to write this event
     */
    static async tryAdminEvent<O extends OrganizationForPermissionCalculation>(event: EventDataForPermission, {getOrganization, userPermissions, platform}: {getOrganization: (id: string) => Promise<O>, userPermissions: UserPermissions | null, platform: Platform}): Promise<O | null> {
        if(!userPermissions) {
            throw new SimpleError({
                code: 'permission_denied',
                message: 'Je hebt geen toegangsrechten om een activiteit te beheren.',
                statusCode: 400
            })
        }

        const accessRight: AccessRight = AccessRight.EventWrite;
        const eventForTags = event.meta.organizationTagIds;
        const eventForDefaultAgeGroupIds = event.meta.defaultAgeGroupIds;

        //#region organization and groups
        const eventForOrganization = event.organizationId;
        const eventForGroups = event.meta.groups;

        if(eventForOrganization !== null) {
            let organization: O;

            try {
                organization = await getOrganization(eventForOrganization);
            } catch(error) {
                console.error(error);
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Event not found',
                    human: 'De activiteit werd niet gevonden',
                })
            }

            if(eventForOrganization !== organization.id) {
                // todo
                throw new Error('todo');
            }

            const organizationPermissions = userPermissions.forOrganization(organization, platform);

            if(!organizationPermissions) {
                throw new SimpleError({
                    code: 'permission_denied',
                    message: 'Je hebt geen toegangsrechten om een activiteit te beheren voor deze organisatie.',
                    statusCode: 400
                })
            }

            if(eventForGroups === null) {
                if(!organizationPermissions.hasResourceAccessRight(PermissionsResourceType.Groups, '', accessRight)) {
                    throw new SimpleError({
                        code: 'permission_denied',
                        message: 'Je hebt geen toegangsrechten om een activiteit te beheren voor deze organisatie.',
                        statusCode: 400
                    })
                }
            } else {
                for(const group of eventForGroups) {
                    if(!organizationPermissions.hasResourceAccessRight(PermissionsResourceType.Groups, group.id, accessRight)) {
                        throw new SimpleError({
                            code: 'permission_denied',
                            message: 'Je hebt geen toegangsrechten om een activiteit te beheren voor deze groep(en).',
                            statusCode: 400
                        })
                    }
                }
            }

            if(eventForTags !== null) {
                // not supported currently
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Een activiteit voor een organisatie kan geen tags bevatten.',
                    statusCode: 400
                })
            }

            if(eventForDefaultAgeGroupIds !== null) {
                // not supported currently
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Een activiteit voor een organisatie kan niet beperkt worden tot specifieke standaard leeftijdsgroepen.',
                    statusCode: 400
                })
            }

            return organization;
        } else if(eventForGroups !== null) {
            // not supported currently
            throw new SimpleError({
                code: 'permission_denied',
                message: 'Een nationale of reginale activiteit kan (momenteel) niet beperkt worden tot specifieke groepen.',
                statusCode: 400
            })
        }
        //#endregion

        //#region platform
        const platformPermissions = userPermissions.forPlatform(platform);
        if(!platformPermissions) {
            throw new SimpleError({
                code: 'permission_denied',
                message: 'Je hebt geen toegangsrechten om een nationale of regionale activiteit te beheren.',
                statusCode: 400
            })
        }

        //organization tags
        if(eventForTags === null) {
            if(!(platformPermissions.hasAccessRight(accessRight) || platformPermissions.hasResourceAccessRight(PermissionsResourceType.OrganizationTags, '', accessRight))) {
                throw new SimpleError({
                    code: 'permission_denied',
                    message: 'Je hebt geen toegangsrechten om een nationale of regionale activiteit te beheren voor alle groepen.',
                    statusCode: 400
                })
            }
        } else {
            for(const tagId of eventForTags) {
                if(!platformPermissions.hasResourceAccessRight(PermissionsResourceType.OrganizationTags, tagId, accessRight)) {
                    throw new SimpleError({
                        code: 'permission_denied',
                        message: "Je hebt geen toegangsrechten om een nationale of regionale activiteit te beheren voor deze regio('s).",
                        statusCode: 400
                    })
                }
            }
        }
        //#endregion

        return null;
    }

    static canAdminSome({userPermissions, platform, organization}: {userPermissions: UserPermissions | null, platform: Platform, organization: OrganizationForPermissionCalculation | null}) {
        if(!userPermissions) {
            return false;
        }

        const accessRight: AccessRight = AccessRight.EventWrite;

        // if can add event for platform
        const platformPermissions = userPermissions.forPlatform(platform);
        if(platformPermissions?.hasAccessRightForSomeResource(PermissionsResourceType.OrganizationTags,accessRight)) {
            return true;
        }

        if(organization) {
            // if can add event for some organization
            const organizationPermissions = userPermissions.forOrganization(organization, platform);
            if(organizationPermissions?.hasAccessRightForSomeResource(PermissionsResourceType.Groups, accessRight)) {
                return true;
            }
        }

        return false;
    }
}
