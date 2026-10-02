import type { StamhoofdFilter } from '@stamhoofd/structures';
import { privateOrderFilterCompilers, privateOrderWithTicketsFilterCompilers } from '@stamhoofd/structures';

/**
 * The keys that can only be answered once the tickets of an order are loaded: everything
 * privateOrderWithTicketsFilterCompilers adds on top of privateOrderFilterCompilers.
 */
const ticketFilterKeys = Object.keys(privateOrderWithTicketsFilterCompilers).filter(key => !(key in privateOrderFilterCompilers));

/**
 * Whether the filter reads one of those keys, at any depth: also inside $and, $or, $not and arrays.
 *
 * The tickets of an order are stored apart from the order itself, so a filter that reads none of them
 * can run without loading them.
 */
export function filterNeedsTickets(filter: StamhoofdFilter | null): boolean {
    return filterUsesKeys(filter, ticketFilterKeys);
}

function filterUsesKeys(filter: StamhoofdFilter | null, keys: string[]): boolean {
    if (Array.isArray(filter)) {
        return filter.some(subFilter => filterUsesKeys(subFilter, keys));
    }

    if (filter === null || typeof filter !== 'object') {
        return false;
    }

    return Object.entries(filter).some(([key, value]) => keys.includes(key) || filterUsesKeys(value as StamhoofdFilter, keys));
}
