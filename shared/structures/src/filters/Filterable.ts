import type { StamhoofdFilter } from '@stamhoofd/common-filters/StamhoofdFilterTypes';

export interface Filterable {
    doesMatchFilter(filter: StamhoofdFilter): boolean;
}
