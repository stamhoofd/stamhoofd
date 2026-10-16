import type { StamhoofdFilter } from './StamhoofdFilterTypes.js';

export interface Filterable {
    doesMatchFilter(filter: StamhoofdFilter): boolean;
}
