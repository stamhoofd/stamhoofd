import { SortItemDirection } from '@stamhoofd/structures';
import { useWebshopsObjectFetcher } from '../../fetchers/useWebshopsObjectFetcher';
import { RelationFetcher } from '../RelationUIFilter';

export function useWebshopsRelationFetcher() {
    const fetcher = useWebshopsObjectFetcher();

    return new RelationFetcher({
        fetcher,
        getName: w => w.webshop.meta.name,
        getValue: w => w.id,
        sort: [{ key: 'name', order: SortItemDirection.ASC }],
    });
}
