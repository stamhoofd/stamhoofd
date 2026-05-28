import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import type { Group, StamhoofdFilter } from '@stamhoofd/structures';
import { GroupType, SortItemDirection } from '@stamhoofd/structures';
import { useGroupsObjectFetcher } from '../../fetchers/useGroupsObjectsFetcher';
import { RelationFetcher, RelationFetcherSubFilter } from '../RelationUIFilter';

type ObjectType = Group;

export function useGroupsRelationFetcher() {
    const fetcher = useGroupsObjectFetcher();
    const organizationManager = useOrganizationManager();
    const owner = useRequestOwner();

    return ({periodId, type}: {periodId?: string, type?: GroupType | GroupType[]} = {}) => {
        const filter: StamhoofdFilter = {};

        if (type) {
            filter.type = type;
        }

        if (periodId) {
            filter.periodId = periodId;
        }

        let getName: (object: ObjectType) => string;
        let subFilter: RelationFetcherSubFilter | undefined = undefined;

        if (type === GroupType.Membership && periodId === undefined) {
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
            filter,
            subFilter,
            sort: [{ key: 'name', order: SortItemDirection.ASC }, {key: 'periodId', order: SortItemDirection.ASC}],
        });
    }
}
