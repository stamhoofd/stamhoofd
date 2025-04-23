/**
 * PermissionLevels are used to grant permissions to specific resources or system wide
 */
export enum PermissionLevel {
    /** No access */
    None = 'None',

    /** Read all data, but not allowed to write */
    Read = 'Read',

    /** Read, write, add, delete child data, but not allowed to modify settings */
    Write = 'Write',

    /** Full access */
    Full = 'Full',
}

export function getPermissionLevelNumber(level: PermissionLevel): number {
    switch (level) {
        case PermissionLevel.None: return 0;
        case PermissionLevel.Read: return 1;
        case PermissionLevel.Write: return 2;
        case PermissionLevel.Full: return 3;
        default: {
            const l: never = level; // will throw compile error if new levels are added without editing this method
            throw new Error('Unknown permission level ' + l);
        }
    }
}

export function maximumPermissionlevel(...levels: PermissionLevel[]): PermissionLevel {
    let max = PermissionLevel.None;
    for (const level of levels) {
        if (getPermissionLevelNumber(level) > getPermissionLevelNumber(max)) {
            max = level;
        }
    }
    return max;
}

export function minimumPermissionLevel(...levels: PermissionLevel[]): PermissionLevel {
    let min: PermissionLevel = levels[0];
    for (const level of levels) {
        if (getPermissionLevelNumber(level) < getPermissionLevelNumber(min)) {
            min = level;
        }
    }
    return min;
}

export function getPermissionLevelName(level: PermissionLevel): string {
    switch (level) {
        case PermissionLevel.None: return $t(`e7aebbf1-8a3a-4288-932f-1678c7bb16ca`);
        case PermissionLevel.Read: return $t(`7afc105f-d34d-4b93-9b33-a6cc08c818ee`);
        case PermissionLevel.Write: return $t(`ad3ad207-6470-4f3e-aaf4-1ea5ea8b85ad`);
        case PermissionLevel.Full: return $t(`c2296305-99a9-497a-aed3-7bb3d2293ce8`);
        default: {
            const l: never = level; // will throw compile error if new levels are added without editing this method
            throw new Error('Unknown permission level ' + l);
        }
    }
}
