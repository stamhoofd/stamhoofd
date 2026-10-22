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
