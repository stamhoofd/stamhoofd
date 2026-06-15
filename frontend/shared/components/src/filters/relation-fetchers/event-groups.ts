import type { Event, Group } from '@stamhoofd/structures';
import { SortItemDirection } from '@stamhoofd/structures';
import { useEventsObjectFetcher } from '../../fetchers/useEventsObjectFetcher';
import { useOrganization } from '#hooks/useOrganization.ts';
import { RelationFetcher } from '../RelationUIFilter';

export function useEventGroupsRelationFetcher() {
    // event fetcher
    const fetcher = useEventsObjectFetcher({ requiredFilter: {
        groupId: {
            $not: null,
        },
    } });

    const organization = useOrganization();

    return ({ periodId }: { periodId?: string } = {}) => {
        const filter = periodId
            ? {
                    group: {
                        $elemMatch: {
                            periodId,
                        },
                    },
                }
            : undefined;

        return new RelationFetcher({
            fetcher,
            filter,
            getName: event => event.name,
            getValue: event => getGroup(event).id,
            getDescription: (event) => {
                if (!organization.value) {
                    const organizationName = event.meta.organizationCache?.name;

                    if (organizationName) {
                        return `${organizationName}, ${event.dateRange}`;
                    }
                }

                return `${event.dateRange}`;
            },
            sort: [{ key: 'name', order: SortItemDirection.ASC }],
        });
    };
}

function getGroup(event: Event): Group {
    const group = event.group;
    if (!group) {
        throw new Error(`Event ${event.id} has no group`);
    }

    return group;
}
