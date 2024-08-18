import { CountFilteredRequest, LimitedFilteredRequest, SortList, StamhoofdFilter } from "@stamhoofd/structures";

export interface ObjectFetcher<O> {
    extendSort?(list: SortList): SortList
    requiredFilter?: StamhoofdFilter|null|undefined
    fetch(data: LimitedFilteredRequest): Promise<{results: O[], next?: LimitedFilteredRequest}>

    fetchCount(data: CountFilteredRequest): Promise<number>

    destroy?(): void
}
