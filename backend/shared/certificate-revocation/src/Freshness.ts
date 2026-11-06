/** Our clock and an authority's are never exactly the same. */
const CLOCK_TOLERANCE_IN_MS = 5 * 60 * 1000;

/**
 * However far away an authority puts its own next update, and whether it names one at all, nothing it
 * said is believed longer than this.
 */
export const MAXIMUM_FRESHNESS_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Whether what an authority said about a certificate still says something now.
 *
 * It may not be dated after us, and its next update may not have passed. A statement that names no
 * next update is the awkward one: the authority is telling us newer information is always available,
 * so it is believed only while it is young enough that a revocation cannot have slipped in behind it.
 */
export function isCurrent(thisUpdate: Date, nextUpdate: Date | null, now: Date = new Date()): boolean {
    if (thisUpdate.getTime() > now.getTime() + CLOCK_TOLERANCE_IN_MS) {
        return false;
    }

    if (nextUpdate === null) {
        return thisUpdate.getTime() >= now.getTime() - MAXIMUM_FRESHNESS_IN_MS;
    }

    return nextUpdate.getTime() >= now.getTime() - CLOCK_TOLERANCE_IN_MS;
}

/** A moment an authority stamped on something, which may not sit after us. */
export function isNotInTheFuture(moment: Date, now: Date = new Date()): boolean {
    return moment.getTime() <= now.getTime() + CLOCK_TOLERANCE_IN_MS;
}
