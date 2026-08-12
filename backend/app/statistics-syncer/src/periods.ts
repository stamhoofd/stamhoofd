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

/**
 * The periods whose statistics are settled. Rows belonging to them are left exactly as they are: not
 * written by the sync, and not excluded by the reconciliation either.
 */
export async function loadFrozenPeriodIds(): Promise<Set<string>> {
    const connection = getStatisticsConnection();
    const [rows] = await connection.select(
        'SELECT `id` FROM `registration_periods` WHERE `cutoffAt` IS NOT NULL AND `cutoffAt` <= ?',
        [new Date()],
        { nestTables: false },
    );

    return new Set((rows as unknown as { id: string }[]).map(row => row.id));
}

/**
 * MySQL cannot be handed an empty IN list, and "belongs to no period" is never frozen: a row without
 * a period is not part of any year's settled numbers.
 */
export function isFrozen(frozenPeriodIds: Set<string>, periodId: string | null | undefined): boolean {
    return typeof periodId === 'string' && frozenPeriodIds.has(periodId);
}
