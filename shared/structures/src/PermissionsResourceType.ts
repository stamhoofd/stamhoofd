import { AccessRight } from './AccessRight.js';
import { PermissionLevel } from './PermissionLevel.js';

/**
 * More granular access rights to specific things in the system
 */
export enum PermissionsResourceType {
    Webshops = 'Webshops',
    Groups = 'Groups',
    GroupCategories = 'GroupCategories',
    OrganizationTags = 'OrganizationTags',
    RecordCategories = 'RecordCategory',

    /**
     * Sending emails and other communication via a sender and viewing the history of sent messages
     */
    Senders = 'Senders',
}

export function getPermissionResourceTypeName(type: PermissionsResourceType, plural = true): string {
    switch (type) {
        case PermissionsResourceType.Webshops: return plural ? 'webshops' : 'webshop';
        case PermissionsResourceType.Groups: return plural ? $t(`%n1`) : $t(`%14Z`);
        case PermissionsResourceType.GroupCategories: return plural ? $t(`%15H`) : $t(`%n2`);
        case PermissionsResourceType.OrganizationTags: return plural ? $t(`%2C`) : $t(`%2T`);
        case PermissionsResourceType.RecordCategories: return plural ? $t(`%n3`) : $t(`%n4`);
        case PermissionsResourceType.Senders: return plural ? $t(`%1DI`) : $t(`%1DJ`);
    }
}

export function getConfigurableAccessRightsForResourceType(type: PermissionsResourceType): AccessRight[] {
    switch (type) {
        case PermissionsResourceType.Senders:
            return [AccessRight.SendMessages];
    }

    return [];
}

export function getConfigurablePermissionLevelsForResourceType(type: PermissionsResourceType): PermissionLevel[] {
    switch (type) {
        case PermissionsResourceType.Senders:
            return [PermissionLevel.None, PermissionLevel.Read, PermissionLevel.Write];
    }
    return [PermissionLevel.None, PermissionLevel.Read, PermissionLevel.Write, PermissionLevel.Full];
}

export function getDefaultAccessRightsForResourceType(type: PermissionsResourceType): AccessRight[] {
    switch (type) {
        case PermissionsResourceType.Senders:
            return [AccessRight.SendMessages];
    }

    return [];
}

export function getDefaultPermissionLevelForResourceType(type: PermissionsResourceType): PermissionLevel {
    switch (type) {
        case PermissionsResourceType.Senders:
            return PermissionLevel.None;
    }
    return PermissionLevel.Full;
}
