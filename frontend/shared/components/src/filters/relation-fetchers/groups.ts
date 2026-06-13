import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import type { Group, GroupType, StamhoofdFilter } from '@stamhoofd/structures';
import { SortItemDirection } from '@stamhoofd/structures';
import { useGroupsObjectFetcher } from '../../fetchers/useGroupsObjectsFetcher';
import { RelationFetcher, RelationFetcherSubFilter } from '../RelationUIFilter';

type ObjectType = Group;

export function useGroupsRelationFetcher() {
    const fetcher = useGroupsObjectFetcher({ requiredFilter: {
        deletedAt: null,
    } });
    const organizationManager = useOrganizationManager();
    const owner = useRequestOwner();

    return ({ periodId, type, defaultPeriodId, isPeriodRequired }: { periodId?: string; type?: GroupType | GroupType[]; defaultPeriodId?: string; isPeriodRequired?: boolean } = {}) => {
        const filter: StamhoofdFilter = {};

        if (type) {
            filter.type = type;
        }

        if (periodId) {
            filter.periodId = periodId;
        }

        let getName: (object: ObjectType) => string;
        const getDescription: ((object: ObjectType) => string) | undefined = undefined;
        let subFilter: RelationFetcherSubFilter | undefined = undefined;

        if (periodId === undefined) {
            getName = (group) => {
                const groupName = group.settings.name.toString();
                const periodName = group.settings.period?.nameShort;
                if (periodName) {
                    return `${groupName} (${periodName})`;
                }
                return groupName;
            };

            subFilter = new RelationFetcherSubFilter({
                getOptions: async () => {
                    const list = await organizationManager.value.loadPeriods(false, false, owner);

                    return (list.periods.slice(0, 10) ?? []).map((p) => {
                        return {
                            name: p.name,
                            filter: { periodId: p.id },
                        };
                    });
                },
                isRequired: isPeriodRequired,
                findDefaultFilter: (option) => {
                    if (option?.filter) {
                        return (option.filter as { periodId: string }).periodId === defaultPeriodId;
                    }
                    return false;
                },
            });
        } else {
            getName = group => group.settings.name.toString();
        }

        return new RelationFetcher({
            fetcher,
            getName,
            getValue: group => group.id,
            getDescription,
            filter,
            subFilter,
            sort: [{ key: 'name', order: SortItemDirection.ASC }, { key: 'periodId', order: SortItemDirection.ASC }],
        });
    };
}
