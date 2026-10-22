import type { InfiniteObjectFetcher } from '#tables/classes/InfiniteObjectFetcher.ts';
import type { ObjectFetcher } from '#tables/classes/ObjectFetcher.ts';
import type { StamhoofdFilter } from '@stamhoofd/structures';

export type RelationFilterOption<T extends string | number | Date | null | boolean> = {
    name: string;
    description?: string;
    value: T;
};

export type RelationFetcherSubFilterOption = { filter: StamhoofdFilter; name: string };

export interface RelationFetcherSubFilterContract {
    readonly shouldHaveDefaultFilter: boolean;
    loadOptions(): Promise<RelationFetcherSubFilterOption[]>;
    getDefaultOption(options: RelationFetcherSubFilterOption[]): RelationFetcherSubFilterOption;
    getAllOptions(): Promise<RelationFetcherSubFilterOption[]>;
}

export interface RelationFetcherContract<ObjectType extends { id: string }, T extends string | number | Date | null | boolean> {
    readonly fetcher: ObjectFetcher<ObjectType>;
    readonly filter?: StamhoofdFilter;
    readonly subFilter?: RelationFetcherSubFilterContract;
    configureInfiniteObjectFetcher(fetcher: InfiniteObjectFetcher<ObjectType>): void;
    resultsToOptions(results: ObjectType[]): RelationFilterOption<T>[];
}

export type RelationUIFilterViewProperties<T extends string | number | Date | null | boolean, ObjectType extends { id: string } = { id: string }> = {
    filter: {
        relationFetcher: RelationFetcherContract<ObjectType, T>;
        values: RelationFilterOption<T>[];
        defaultOptions: RelationFilterOption<T>[];
    };
    searchEnabled?: boolean;
};
