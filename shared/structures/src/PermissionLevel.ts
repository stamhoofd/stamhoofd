/**
 * PermissionLevels are used to grant permissions to specific resources or system wide
 */
export enum PermissionLevel {
    /** No access */
    None = "None",

    /** Read all data, but not allowed to write */
    Read = "Read",
    
    /** Read, write, add, delete child data, but not allowed to modify settings */
    Write = "Write",
    
    /** Full access */
    Full = "Full",
}



export function getPermissionLevelNumber(level: PermissionLevel): number {
    switch (level) {
        case PermissionLevel.None: return 0;
        case PermissionLevel.Read: return 1;
        case PermissionLevel.Write: return 2;
        case PermissionLevel.Full: return 3;
        default: {
            const l: never = level; // will throw compile error if new levels are added without editing this method
            throw new Error("Unknown permission level "+l);
        }
    }
}

export function maximumPermissionlevel(...levels: PermissionLevel[]): PermissionLevel {
    let max = PermissionLevel.None
    for (const level of levels) {
        if (getPermissionLevelNumber(level) > getPermissionLevelNumber(max)) {
            max = level
        }
    }
    return max

}

export function minimumPermissionLevel(...levels: PermissionLevel[]): PermissionLevel {
    let min: PermissionLevel = levels[0]
    for (const level of levels) {
        if (getPermissionLevelNumber(level) < getPermissionLevelNumber(min)) {
            min = level
        }
    }
    return min

}

export function getPermissionLevelName(level: PermissionLevel): string {
    switch (level) {
        case PermissionLevel.None: return 'Geen basistoegang';
        case PermissionLevel.Read: return 'Lezen';
        case PermissionLevel.Write: return 'Bewerken';
        case PermissionLevel.Full: return 'Volledige toegang';
        default: {
            const l: never = level; // will throw compile error if new levels are added without editing this method
            throw new Error("Unknown permission level "+l);
        }
    }
}
