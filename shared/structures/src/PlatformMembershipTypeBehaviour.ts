/**
 * Lives in its own module rather than in Platform.ts to keep it importable without pulling in
 * Platform.ts. Platform.ts sits in an import cycle
 * (Platform -> RegistrationPeriod -> BundleDiscount -> RegisterItem), and every edge of that cycle
 * is a real value dependency: `@field` decoders in Platform.ts and RegistrationPeriod.ts, and
 * `instanceof RegisterItem` in BundleDiscount.ts. RegisterItem only ever needed this enum, so
 * importing it from here is what keeps the cycle broken -- see the comment in Platform.ts.
 */
export enum PlatformMembershipTypeBehaviour {
    /**
     * A membership that is valid for a certain period
     */
    Period = 'Period',

    /**
     * A membership that is valid for a certain number of days
     */
    Days = 'Days',
}
