import { SortItemDirection } from '@stamhoofd/structures';
import { useOrganizationsObjectFetcher } from '../../fetchers';
import { RelationFetcher } from '../RelationUIFilter';

export function useOrganizationsRelationFetcher() {
    const fetcher = useOrganizationsObjectFetcher({
        // filter on name first
        extendSort: () => [{ key: 'name', order: SortItemDirection.ASC }, { key: 'id', order: SortItemDirection.ASC }],
    });

    return new RelationFetcher({
        fetcher,
        getName: (organization) => organization.name,
        getValue: (organization) => organization.id,
        limit: 20
    })
}
