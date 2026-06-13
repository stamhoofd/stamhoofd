import { SortItemDirection } from '@stamhoofd/structures';
import { useOrganizationsObjectFetcher } from '#fetchers/useOrganizationsObjectFetcher.ts';
import { RelationFetcher } from '../RelationUIFilter';

export function useOrganizationsRelationFetcher() {
    const fetcher = useOrganizationsObjectFetcher();

    return new RelationFetcher({
        fetcher,
        getName: (organization) => organization.name,
        getValue: (organization) => organization.id,
        sort: [{ key: 'name', order: SortItemDirection.ASC }],
    })
}
