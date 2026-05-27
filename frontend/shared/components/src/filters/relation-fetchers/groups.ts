import type { Group } from '@stamhoofd/structures';
import { GroupType, SortItemDirection } from '@stamhoofd/structures';
import { useGroupsObjectFetcher } from '../../fetchers/useGroupsObjectsFetcher';
import type { ObjectFetcher } from '../../tables';
import { RelationFetcher } from '../RelationUIFilter';

type ObjectType = Group;

export function useGroupsRelationFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>) {
    const fetcher = useGroupsObjectFetcher(overrides);

    return new RelationFetcher({
        fetcher,
        getName: (group) => group.settings.name.toString(),
        getValue: (group) => group.id,
        sort: [{ key: 'name', order: SortItemDirection.ASC }],
    })
}

export function useEventGroupsRelationFetcher() {
    return useGroupsRelationFetcher({ requiredFilter: {
        type: GroupType.EventRegistration
    }});
}

export function useMembershipGroupsRelationFetcher() {
    return useGroupsRelationFetcher({ requiredFilter: {
        type: GroupType.Membership
    }});
}
