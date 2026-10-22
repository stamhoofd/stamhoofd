import type { StamhoofdFilter } from '@stamhoofd/filters/StamhoofdFilterTypes';

export interface Filterable {
    doesMatchFilter(filter: StamhoofdFilter): boolean;
}
