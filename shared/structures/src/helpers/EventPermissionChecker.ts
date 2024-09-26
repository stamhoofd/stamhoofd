import { SimpleError } from '@simonbackx/simple-errors';
import { AccessRight } from '../AccessRight';
import { NamedObject } from '../Event';
import { PermissionsResourceType } from '../PermissionsResourceType';
import { Platform } from '../Platform';
import { OrganizationForPermissionCalculation, UserPermissions } from '../UserPermissions';

interface EventDataForPermission {
    organizationId: string | null;
    meta: {
        defaultAgeGroupIds: string[] | null;
        groups: NamedObject[] | null;
        organizationTagIds: string[] | null;
    };
}

export class EventPermissionChecker {
    /**
     * Will throw error if not allowed to edit/add/delete this event
     * @param event
     * @returns Organization if event for specific organization, else null
     * @throws error if not allowed to write this event
     */
    static async checkEventAccessAsync<O extends OrganizationForPermissionCalculation>(
        event: EventDataForPermission,
        {
            getOrganization,
            userPermissions,
            platform,
        }: {
            getOrganization: (id: string) => Promise<O>;
            userPermissions: UserPermissions | null;
            platform: Platform;
        },
    ): Promise<O | null> {
        if (!userPermissions) {
            throw new SimpleError({
                code: 'permission_denied',
                message:
                    'Je hebt geen toegangsrechten om een activiteit te beheren.',
                statusCode: 403,
            });
        }

        if (event.organizationId !== null) {
            let organization: O;

            try {
                organization = await getOrganization(event.organizationId);
            }
            catch (error) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Event not found',
                    human: 'De activiteit werd niet gevonden',
                });
            }

            this.tryAdminOrganizationEvent(
                event,
                organization,
                platform,
                userPermissions,
            );
            return organization;
        }

        this.tryAdminNationalOrRegionalEvent(event, userPermissions, platform);
        return null;
    }

    /**
     * Will throw error if not allowed to edit/add/delete this event
     * @param event
     * @throws error if not allowed to write this event
     */
    static checkEventAccess<O extends OrganizationForPermissionCalculation>(
        event: EventDataForPermission,
        {
            organization,
            userPermissions,
            platform,
        }: {
            organization: O | null;
            userPermissions: UserPermissions | null;
            platform: Platform;
        },
    ): void {
        if (!userPermissions) {
            throw new SimpleError({
                code: 'permission_denied',
                message:
                    'Je hebt geen toegangsrechten om een activiteit te beheren.',
                statusCode: 403,
            });
        }

        if (event.organizationId !== null) {
            if (organization === null) {
                throw new Error('Organization not specified.');
            }
            this.tryAdminOrganizationEvent(
                event,
                organization,
                platform,
                userPermissions,
            );
        }
        else {
            this.tryAdminNationalOrRegionalEvent(event, userPermissions, platform);
        }
    }

    static canAdminEvent<O extends OrganizationForPermissionCalculation>(
        event: EventDataForPermission,
        options: {
            organization: O | null;
            userPermissions: UserPermissions | null;
            platform: Platform;
        },
    ): boolean {
        try {
            this.checkEventAccess(event, options);
        }
        catch (error) {
            console.error(error);
            return false;
        }

        return true;
    }

    private static tryAdminOrganizationEvent<O extends OrganizationForPermissionCalculation>(
        event: EventDataForPermission,
        organization: O,
        platform: Platform,
        userPermissions: UserPermissions,
    ): void {
        const accessRight: AccessRight = AccessRight.EventWrite;

        if (event.organizationId !== organization.id) {
            // todo
            throw new Error('todo');
        }

        const organizationPermissions = userPermissions.forOrganization(
            organization,
            platform,
        );

        if (!organizationPermissions) {
            throw new SimpleError({
                code: 'permission_denied',
                message:
                    'Je hebt geen toegangsrechten om een activiteit te beheren voor deze organisatie.',
                statusCode: 403,
            });
        }

        if (event.meta.groups === null) {
            if (
                !organizationPermissions.hasResourceAccessRight(
                    PermissionsResourceType.Groups,
                    '',
                    accessRight,
                )
            ) {
                throw new SimpleError({
                    code: 'permission_denied',
                    message:
                            'Je hebt geen toegangsrechten om een activiteit te beheren voor deze organisatie.',
                    statusCode: 403,
                });
            }
        }
        else {
            for (const group of event.meta.groups) {
                if (
                    !organizationPermissions.hasResourceAccessRight(
                        PermissionsResourceType.Groups,
                        group.id,
                        accessRight,
                    )
                ) {
                    throw new SimpleError({
                        code: 'permission_denied',
                        message:
                            'Je hebt geen toegangsrechten om een activiteit te beheren voor deze groep(en).',
                        statusCode: 403,
                    });
                }
            }
        }
    }

    private static tryAdminNationalOrRegionalEvent(
        event: EventDataForPermission,
        userPermissions: UserPermissions,
        platform: Platform,
    ): void {
        const accessRight: AccessRight = AccessRight.EventWrite;
        const platformPermissions = userPermissions.forPlatform(platform);
        if (!platformPermissions) {
            throw new SimpleError({
                code: 'permission_denied',
                message:
                    'Je hebt geen toegangsrechten om een nationale activiteit te beheren.',
                statusCode: 403,
            });
        }

        if (event.meta.groups !== null) {
            // not supported currently
            throw new SimpleError({
                code: 'permission_denied',
                message:
                    'Een nationale of regionale activiteit kan (momenteel) niet beperkt worden tot specifieke groepen.',
                statusCode: 403,
            });
        }

        // organization tags
        if (event.meta.organizationTagIds === null) {
            if (
                !(
                    platformPermissions.hasAccessRight(accessRight)
                    || platformPermissions.hasResourceAccessRight(
                        PermissionsResourceType.OrganizationTags,
                        '',
                        accessRight,
                    )
                )
            ) {
                throw new SimpleError({
                    code: 'permission_denied',
                    message:
                        'Je hebt geen toegangsrechten om een nationale activiteit te beheren voor alle groepen.',
                    statusCode: 403,
                });
            }
        }
        else {
            for (const tagId of event.meta.organizationTagIds) {
                if (
                    !platformPermissions.hasResourceAccessRight(
                        PermissionsResourceType.OrganizationTags,
                        tagId,
                        accessRight,
                    )
                ) {
                    throw new SimpleError({
                        code: 'permission_denied',
                        message:
                            "Je hebt geen toegangsrechten om een regionale activiteit te beheren voor deze regio('s).",
                        statusCode: 403,
                    });
                }
            }
        }
    }
}
