import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { AccessRight } from '@stamhoofd/types/AccessRight';
import type { EventPermissionData } from '../EventPermissionData.js';
import type { LoadedPermissions } from '../LoadedPermissions.js';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { PermissionsResourceType } from '@stamhoofd/types/PermissionsResourceType';
import { PermissionsResourceKey } from '../PermissionsResourceType.js';
import type { Platform } from '../Platform.js';
import type { OrganizationForPermissionCalculation, UserPermissions } from '../UserPermissions.js';

export class EventPermissionChecker {
    /**
     * Will throw error if not allowed to edit/add/delete this event
     * @param event
     * @returns Organization if event for specific organization, else null
     * @throws error if not allowed to write this event
     */
    static async checkEventAccessAsync<O extends OrganizationForPermissionCalculation>(
        event: EventPermissionData,
        {
            getOrganization,
            userPermissions,
            platform,
            isPeriodInUse,
        }: {
            getOrganization: (id: string) => Promise<O>;
            userPermissions: UserPermissions | null;
            platform: Platform;
            isPeriodInUse: boolean;
        },
    ): Promise<O | null> {
        if (!userPermissions) {
            throw new SimpleError({
                code: 'permission_denied',
                message:
                    $t(`%qQ`),
                statusCode: 403,
            });
        }

        if (event.organizationId !== null) {
            let organization: O;

            try {
                organization = await getOrganization(event.organizationId);
            } catch (error) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Organization not found',
                    human: $t(`%DY`),
                });
            }

            this.throwIfNoPermissionToWriteEventForOrganization(
                event,
                organization,
                platform,
                userPermissions,
                isPeriodInUse,
            );
            return organization;
        }

        this.throwIfNoPermissionToWriteNationalOrRegionalEvent(event, userPermissions, platform, isPeriodInUse);
        return null;
    }

    /**
     * Will throw error if not allowed to edit/add/delete this event
     * @param event
     * @throws error if not allowed to write this event
     */
    static throwIfNoPermissionToWriteEvent<O extends OrganizationForPermissionCalculation>(
        event: EventPermissionData,
        {
            organization,
            userPermissions,
            platform,
            isPeriodInUse,
        }: {
            organization: O | null;
            userPermissions: UserPermissions | null;
            platform: Platform;
            isPeriodInUse: boolean;
        },
    ): void {
        if (!userPermissions) {
            throw new SimpleError({
                code: 'permission_denied',
                message:
                    $t(`%qQ`),
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
                isPeriodInUse,
            );
        } else {
            this.throwIfNoPermissionToWriteNationalOrRegionalEvent(event, userPermissions, platform, isPeriodInUse);
        }
    }

    static hasPermissionToWriteEvent<O extends OrganizationForPermissionCalculation>(
        event: EventPermissionData,
        options: {
            organization: O | null;
            userPermissions: UserPermissions | null;
            platform: Platform;
            isPeriodInUse: boolean;
        },
    ): boolean {
        try {
            this.throwIfNoPermissionToWriteEvent(event, options);
        } catch (error) {
            if (isSimpleError(error) || isSimpleErrors(error)) {
                return false;
            }
            throw error;
        }

        return true;
    }

    private static throwIfNoPermissionToWriteEventForOrganization<O extends OrganizationForPermissionCalculation>(
        event: EventPermissionData,
        organization: O,
        platform: Platform,
        userPermissions: UserPermissions,
        isPeriodInUse: boolean,
    ): void {
        const accessRight: AccessRight = AccessRight.EventWrite;

        if (event.organizationId !== organization.id) {
            throw new SimpleError({
                code: 'permission_denied',
                message:
                    $t(`%qR`),
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
                    $t(`%qS`),
                statusCode: 403,
            });
        }

        if (this.hasWriteAccessToEventResource(organizationPermissions, event.id, isPeriodInUse)) {
            return;
        }

        if (event.meta.groups === null) {
            if (
                !organizationPermissions.hasResourceAccessRight(
                    PermissionsResourceType.Groups,
                    PermissionsResourceKey.CurrentPeriod,
                    accessRight,
                )
            ) {
                throw new SimpleError({
                    code: 'permission_denied',
                    message:
                            $t(`%qS`),
                    statusCode: 403,
                });
            }
        } else {
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
                            $t(`%qT`),
                        statusCode: 403,
                    });
                }
            }
        }
    }

    private static hasWriteAccessToEventResource(permissions: LoadedPermissions, eventId: string, isPeriodInUse: boolean): boolean {
        return permissions.forPeriod(isPeriodInUse)
            .hasResourceAccess(PermissionsResourceType.Events, eventId, PermissionLevel.Write);
    }

    private static throwIfNoPermissionToWriteNationalOrRegionalEvent(
        event: EventPermissionData,
        userPermissions: UserPermissions,
        platform: Platform,
        isPeriodInUse: boolean,
    ): void {
        const accessRight: AccessRight = AccessRight.EventWrite;
        const platformPermissions = userPermissions.forPlatform(platform);
        if (!platformPermissions) {
            throw new SimpleError({
                code: 'permission_denied',
                message:
                    $t(`%qU`),
                statusCode: 403,
            });
        }

        if (this.hasWriteAccessToEventResource(platformPermissions, event.id, isPeriodInUse)) {
            return;
        }

        // organization tags
        if (event.meta.organizationTagIds === null) {
            if (
                !(platformPermissions.hasResourceAccessRight(
                    PermissionsResourceType.OrganizationTags,
                    PermissionsResourceKey.All,
                    accessRight,
                )
                )
            ) {
                throw new SimpleError({
                    code: 'permission_denied',
                    message:
                        $t(`%qV`),
                    statusCode: 403,
                });
            }
        } else {
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
                            $t(`%qW`),
                        statusCode: 403,
                    });
                }
            }
        }
    }
}
