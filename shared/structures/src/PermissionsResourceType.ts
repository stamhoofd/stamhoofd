import { AccessRight } from './AccessRight';
import { PermissionLevel } from './PermissionLevel';

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
        case PermissionsResourceType.Groups: return plural ? $t(`2415fc43-835e-4181-b416-6c0fff5db947`) : $t(`b427a2eb-4d55-4f41-b60e-ae3c6819100d`);
        case PermissionsResourceType.GroupCategories: return plural ? $t(`a4ace71b-cafd-414d-8bce-e2f56cb8ebe9`) : $t(`079d3877-b607-4f3b-8139-7f5f4463bd19`);
        case PermissionsResourceType.OrganizationTags: return plural ? $t(`e80487d1-d969-41fe-b2e8-59192e639fbb`) : $t(`fe29857c-e4ac-4b25-aa0e-31813f3570c2`);
        case PermissionsResourceType.RecordCategories: return plural ? $t(`b609c4cb-238c-4b27-bae5-9ee9f307ffb4`) : $t(`2ccc972d-a3a4-4ea4-8a47-20d7b57f035c`);
        case PermissionsResourceType.Senders: return plural ? $t(`d049c682-f167-4dec-b909-4e1d4c443a94`) : $t(`1407ad7f-146a-423f-8101-d6d3563e10cc`);
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
