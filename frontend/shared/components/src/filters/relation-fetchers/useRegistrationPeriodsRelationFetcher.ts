import { SortItemDirection } from '@stamhoofd/structures';
import { useRegistrationPeriodsObjectFetcher } from '../../fetchers/useRegistrationPeriodsObjectFetcher';
import { RelationFetcher } from '../RelationFetcher';

export function useRegistrationPeriodsRelationFetcher() {
    const fetcher = useRegistrationPeriodsObjectFetcher();

    return new RelationFetcher({
        fetcher,
        getName: period => period.name,
        getValue: period => period.id,
        sort: [
            { key: 'startDate', order: SortItemDirection.DESC },
            { key: 'id', order: SortItemDirection.ASC },
        ],
    });
}
