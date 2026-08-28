import { getStatisticsConnection } from './database.js';

/**
 * The date up to which this platform's statistics come from an imported external source. Periods
 * ending before it are frozen the first time the sync sees them, so the import owns those years.
 * Unset means the platform has no external history and nothing is frozen up front.
 */
export function getImportedUntil(): Date | null {
    const configured = STAMHOOFD.IMPORTED_UNTIL;
    if (!configured) {
        return null;
    }

    const parsed = new Date(configured);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`STAMHOOFD.IMPORTED_UNTIL is not a valid date: ${configured}`);
    }

    return parsed;
}

/**
 * How long after a period ended unlocking it in the administration still brings it back into the
 * sync. A period is unlocked to correct something, and beyond this an old year would have all of its
 * numbers written again from what the administration says today rather than the one thing corrected.
 */
export const releaseWindow = 365 * 24 * 60 * 60 * 1000;

/**
 * Give periods that ended before the imported history a cutoff, once. Only ever fills a cutoff that
 * is still empty, so a date set by hand afterwards stays put.
 */
export async function applyImportedCutoff(importedUntil: Date | null): Promise<void> {
    if (!importedUntil) {
        return;
    }

    const connection = getStatisticsConnection();
    await connection.update(
        'UPDATE `registration_periods` SET `cutoffAt` = ? WHERE `cutoffAt` IS NULL AND `endDate` < ?',
        [importedUntil, importedUntil],
    );
}

async function loadPeriodIds(where: string, params: unknown[]): Promise<Set<string>> {
    const connection = getStatisticsConnection();
    const [rows] = await connection.select(
        `SELECT \`id\` FROM \`registration_periods\` WHERE ${where}`,
        params,
        { nestTables: false },
    );

    return new Set((rows as unknown as { id: string }[]).map(row => row.id));
}

const settledWhere = '`cutoffAt` IS NOT NULL AND `cutoffAt` <= ?';

/**
 * The periods left alone entirely, their own row included: the years an import owns and the ones
 * settled by hand. The sync never wrote those rows, so it does not rewrite them either.
 */
export function loadSettledPeriodIds(): Promise<Set<string>> {
    return loadPeriodIds(settledWhere, [new Date()]);
}

/**
 * The periods whose statistics are settled. Rows belonging to them are left exactly as they are: not
 * written by the sync, and not excluded by the reconciliation either.
 *
 * Either because their cutoff has passed, or because the administration locked them and a full run
 * has carried in what happened up to that lock.
 */
export function loadFrozenPeriodIds(): Promise<Set<string>> {
    return loadPeriodIds(`(${settledWhere}) OR \`lockedAt\` IS NOT NULL`, [new Date()]);
}

/**
 * Stop following the periods the administration has locked.
 *
 * Called once a whole run has come through, incremental pass and delete reconciliation both: the day
 * a period is locked is a day like any other until then, and its changes and its deletions have to be
 * written before it is settled. A run that failed never reaches this, so the next one reads that
 * period again and settles it only once it succeeds.
 */
export async function settleLockedPeriods(): Promise<void> {
    const connection = getStatisticsConnection();
    await connection.update(
        'UPDATE `registration_periods` SET `lockedAt` = ? WHERE `lockedAt` IS NULL AND `locked` = 1',
        [new Date()],
    );
}

/**
 * Follow a period the administration unlocked again, as long as it ended less than `releaseWindow`
 * ago. An older year keeps the numbers it was settled with: what its rows would be written from is
 * the administration of today, which no longer describes that year.
 */
export async function releaseUnlockedPeriods(): Promise<void> {
    const connection = getStatisticsConnection();
    await connection.update(
        'UPDATE `registration_periods` SET `lockedAt` = NULL WHERE `lockedAt` IS NOT NULL AND `locked` = 0 AND `endDate` > ?',
        [new Date(Date.now() - releaseWindow)],
    );
}

/**
 * MySQL cannot be handed an empty IN list, and "belongs to no period" is never frozen: a row without
 * a period is not part of any year's settled numbers.
 */
export function isFrozen(frozenPeriodIds: Set<string>, periodId: string | null | undefined): boolean {
    return typeof periodId === 'string' && frozenPeriodIds.has(periodId);
}
