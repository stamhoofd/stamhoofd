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

export const PermissionsResourceKey = {
    All: '~all',
    CurrentPeriod: '~currentPeriod',
} as const;

export type PermissionsResourceKey = typeof PermissionsResourceKey[keyof typeof PermissionsResourceKey];

export function isPeriodScopedResourceType(type: PermissionsResourceType): boolean {
    switch (type) {
        case PermissionsResourceType.Groups:
        case PermissionsResourceType.GroupCategories:
            return true;
        case PermissionsResourceType.Webshops:
        case PermissionsResourceType.OrganizationTags:
        case PermissionsResourceType.RecordCategories:
        case PermissionsResourceType.Senders:
            return false;
        default: {
            const t: never = type;
            throw new Error('Unknown resource type ' + (t as string));
        }
    }
}

/**
 * old key '' (meaning all resources) is replaced with:
 *  - '~currentPeriod' for period scoped resource types and
 *  - '~all' for non-period scoped resource types.
 */
export function upgradeResourceKeys<T>(resources: Map<PermissionsResourceType, Map<string, T>>): Map<PermissionsResourceType, Map<string, T>> {
    const upgraded = new Map<PermissionsResourceType, Map<string, T>>();

    for (const [type, values] of resources) {
        const upgradedValues = new Map<string, T>();

        for (const [id, value] of values) {
            if (id === '') {
                upgradedValues.set(isPeriodScopedResourceType(type) ? PermissionsResourceKey.CurrentPeriod : PermissionsResourceKey.All, value);
                continue;
            }
            upgradedValues.set(id, value);
        }

        upgraded.set(type, upgradedValues);
    }

    return upgraded;
}

/**
 * Clients before version 416 only know one wildcard: '' (meaning all resources).
 */
export function downgradeResourceKeys<T>(resources: Map<PermissionsResourceType, Map<string, T>>): Map<PermissionsResourceType, Map<string, T>> {
    const downgraded = new Map<PermissionsResourceType, Map<string, T>>();

    for (const [type, values] of resources) {
        const downgradedValues = new Map<string, T>();

        for (const [id, value] of values) {
            if (id === PermissionsResourceKey.All) {
                downgradedValues.set('', value);
                continue;
            }

            if (id === PermissionsResourceKey.CurrentPeriod) {
                // when both the current period and the all value are set, only keep the all value
                if (!values.has(PermissionsResourceKey.All)) {
                    downgradedValues.set('', value);
                }
                continue;
            }

            downgradedValues.set(id, value);
        }

        downgraded.set(type, downgradedValues);
    }

    return downgraded;
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
