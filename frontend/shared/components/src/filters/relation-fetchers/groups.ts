import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import type { Group, GroupType, StamhoofdFilter } from '@stamhoofd/structures';
import { SortItemDirection } from '@stamhoofd/structures';
import { useGroupsObjectFetcher } from '../../fetchers/useGroupsObjectsFetcher';
import { RelationFetcher, RelationFetcherSubFilter } from '../RelationUIFilter';

type ObjectType = Group;

export function useGroupsRelationFetcher() {
    const fetcher = useGroupsObjectFetcher({requiredFilter: {
        deletedAt: null
    }});
    const organizationManager = useOrganizationManager();
    const owner = useRequestOwner();

    return ({periodId, type}: {periodId?: string, type?: GroupType | GroupType[]} = {}) => {
        const filter: StamhoofdFilter = {};

        if (type) {
            (filter as any).type = type;
        }

        if (periodId) {
            (filter as any).periodId = periodId;
        }

        let getName: (object: ObjectType) => string;
        const getDescription: ((object: ObjectType) => string) | undefined = undefined;
        let subFilter: RelationFetcherSubFilter | undefined = undefined;

        if (periodId === undefined) {
            getName = (group) => {
                return `${group.settings.name.toString()} (${group.settings.period?.nameShort})`;
            }

            subFilter = new RelationFetcherSubFilter({
                getOptions: async () => {
                    const list = await organizationManager.value.loadPeriods(false, false, owner);

                    return (list.periods.slice(0, 10) ?? []).map(p => {
                        return {
                            name: p.name,
                            filter: { periodId: p.id }
                        }
                    })
                }
            })
        } else {
            getName = (group) => group.settings.name.toString();
        }

        return new RelationFetcher({
            fetcher,
            getName,
            getValue: (group) => group.id,
            getDescription,
            filter,
            subFilter,
            sort: [{ key: 'name', order: SortItemDirection.ASC }, {key: 'periodId', order: SortItemDirection.ASC}],
        });
    }
}
