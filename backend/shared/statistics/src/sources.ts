/**
 * Which pipeline wrote a statistics row.
 *
 * The reconciliation checks statistics rows against the main database, so it has to know which rows
 * came from there: imported rows have no counterpart to find and would all be excluded on the first
 * night.
 */
export const syncSource = 'sync';
export const importSource = 'import';
