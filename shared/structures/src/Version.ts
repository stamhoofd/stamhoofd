// -------------------------------------------------------------
//
// WARNING: DO NOT EDIT THIS MANUALLY.
// Use @field({ decoder: any, ...NextVersion }) in your code.
// Only the release command (stam release bump-structures) changes ReleasedVersion.
//
// -------------------------------------------------------------

/**
 * The structures version of the latest release. Production and staging encode and decode at this version.
 */
export const ReleasedVersion = 425;

/**
 * Development and test run one version ahead of the latest release, so fields that are added or changed
 * with `...NextVersion` are already active there (including their `upgrade` and `downgrade` hooks).
 * Production and staging run at `ReleasedVersion`, where those fields are still omitted.
 *
 * `STAMHOOFD` must be defined before this module is evaluated. When it is missing (e.g. the package is
 * used outside of Stamhoofd), the released version is used.
 *
 * Caveat for the development database: rows written locally at `ReleasedVersion + 1` before you pulled
 * a type-changing `...NextVersion` field are not upgraded. Reset or reseed the development database
 * when decoding errors appear.
 */
export const Version = isRunningAhead() ? ReleasedVersion + 1 : ReleasedVersion;

function isRunningAhead(): boolean {
    if (typeof STAMHOOFD === 'undefined') {
        return false;
    }
    return STAMHOOFD.environment === 'development' || STAMHOOFD.environment === 'test';
}

declare global {
    const NextVersion: { /* optional: true; */ version: number };
}

import { AutoEncoder } from '@common/encoding';
AutoEncoder.skipDefaultValuesVersion = 10000; // todo

/**
 * Use this in development when adding fields or changing the type of existing fields (with upgrade/downgrade).
 * On release, the version gets bumped and the usages of NextVersion are replaced by that version.
 */
(globalThis as any).NextVersion = {
    // optional: true,
    version: ReleasedVersion + 1,
    /* defaultValue() {
        return this.upgrade ?? undefined;
    }, */
};
