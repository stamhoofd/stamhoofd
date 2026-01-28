// -------------------------------------------------------------
//
// WARNING: DO NOT EDIT THIS MANUALLY.
// Use @field({decoder: any, ...NextVersion)} in your code.
//
// -------------------------------------------------------------

export const Version = 392;

declare global {
    const NextVersion: { optional: true; version: number };
}
/**
 * Use this in development when making changes to fields.
 * On release, the version will get bumped and the usages of NextVersion will be replaced by that version.
 * Note: during developent all the saved fields with NextVersion will get cleared on the next release.
 */
(globalThis as any).NextVersion = {
    optional: true,
    version: Version,
    defaultValue() {
        return this.upgrade ?? undefined;
    },
};
