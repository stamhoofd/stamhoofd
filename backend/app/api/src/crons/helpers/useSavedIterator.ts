import type { SQLResultNamespacedRow } from '@simonbackx/simple-database';
import type { IterableSQLSelect, SQLSelect } from '@stamhoofd/sql';

export function useSavedIterator<T extends object = SQLResultNamespacedRow>(start: () => SQLSelect<T>, options: { limit: number; maxQueries?: number }) {
    let savedIterator: IterableSQLSelect<T> | null = null;
    let lastFullRun: Date = new Date(0);

    function updateStatus() {
        if (savedIterator && savedIterator.isDone) {
            savedIterator = null;
            lastFullRun = new Date();

            console.log('Done full loop');
        }
    }

    const iterate = function () {
        if (savedIterator === null) {
            savedIterator = start().limit(options.limit).all({
                nextEachHook: updateStatus,
            });
        }

        return savedIterator.maxQueries(options.maxQueries ?? 1);
    };

    const isHoursAgo = function (hours: number) {
        return lastFullRun.getTime() < new Date().getTime() - 1000 * 60 * 60 * hours;
    };

    return { iterate, lastFullRun, isHoursAgo };
}
