import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { AccessRight } from '../AccessRight.js';
import { NamedObject } from '../Event.js';
import { PermissionsResourceType } from '../PermissionsResourceType.js';
import { Platform } from '../Platform.js';
import { OrganizationForPermissionCalculation, UserPermissions } from '../UserPermissions.js';

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
                    $t(`6677e555-3a1c-4628-8271-98e388c10191`),
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
                    message: 'Organization not found',
                    human: $t(`c5f3d2c3-9d7a-473d-ba91-63ce104a2de5`),
                });
            }

            this.throwIfNoPermissionToWriteEventForOrganization(
                event,
                organization,
                platform,
                userPermissions,
            );
            return organization;
        }

        this.throwIfNoPermissionToWriteNationalOrRegionalEvent(event, userPermissions, platform);
        return null;
    }

    /**
     * Will throw error if not allowed to edit/add/delete this event
     * @param event
     * @throws error if not allowed to write this event
     */
    static throwIfNoPermissionToWriteEvent<O extends OrganizationForPermissionCalculation>(
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
                    $t(`6677e555-3a1c-4628-8271-98e388c10191`),
                statusCode: 403,
            });
        }

        if (event.organizationId !== null) {
            if (organization === null) {
                throw new Error('Organization not specified.');
            }
            this.throwIfNoPermissionToWriteEventForOrganization(
                event,
                organization,
                platform,
                userPermissions,
            );
        }
        else {
            this.throwIfNoPermissionToWriteNationalOrRegionalEvent(event, userPermissions, platform);
        }
    }

    static hasPermissionToWriteEvent<O extends OrganizationForPermissionCalculation>(
        event: EventDataForPermission,
        options: {
            organization: O | null;
            userPermissions: UserPermissions | null;
            platform: Platform;
        },
    ): boolean {
        try {
            this.throwIfNoPermissionToWriteEvent(event, options);
        }
        catch (error) {
            if (isSimpleError(error) || isSimpleErrors(error)) {
                return false;
            }
            throw error;
        }

        return true;
    }

    private static throwIfNoPermissionToWriteEventForOrganization<O extends OrganizationForPermissionCalculation>(
        event: EventDataForPermission,
        organization: O,
        platform: Platform,
        userPermissions: UserPermissions,
    ): void {
        const accessRight: AccessRight = AccessRight.EventWrite;

        if (event.organizationId !== organization.id) {
            throw new SimpleError({
                code: 'permission_denied',
                message:
                    $t(`c07f0ada-fdc9-4919-adb4-4c7a2c7acef4`),
                statusCode: 403,
            });
        }

        const organizationPermissions = userPermissions.forOrganization(
            organization,
            platform,
        );

        if (!organizationPermissions) {
            throw new SimpleError({
                code: 'permission_denied',
                message:
                    $t(`f97b2b0d-ae0c-472b-9c4f-81fe13af221e`),
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
                            $t(`f97b2b0d-ae0c-472b-9c4f-81fe13af221e`),
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
                            $t(`82b6b325-3175-4e18-940c-39044d84f1f8`),
                        statusCode: 403,
                    });
                }
            }
        }
    }

    private static throwIfNoPermissionToWriteNationalOrRegionalEvent(
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
                    $t(`83be96ad-4b19-42ef-a1d1-45e69d4c8540`),
                statusCode: 403,
            });
        }

        // organization tags
        if (event.meta.organizationTagIds === null) {
            if (
                !(platformPermissions.hasResourceAccessRight(
                    PermissionsResourceType.OrganizationTags,
                    '',
                    accessRight,
                )
                )
            ) {
                throw new SimpleError({
                    code: 'permission_denied',
                    message:
                        $t(`321ec06c-2977-45a4-b37f-8c94bc48cd8a`),
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
                            $t(`d13353bc-a746-49dc-a2c2-652a35c593fc`),
                        statusCode: 403,
                    });
                }
            }
        }
    }
}
