import { CountFilteredRequest, LimitedFilteredRequest, StamhoofdFilter } from "@stamhoofd/structures";

export interface ObjectFetcher<O> {
    requiredFilter?: StamhoofdFilter|null|undefined
    fetch(data: LimitedFilteredRequest): Promise<{results: O[], next?: LimitedFilteredRequest}>

    fetchCount(data: CountFilteredRequest): Promise<number>

    destroy?(): void
}
