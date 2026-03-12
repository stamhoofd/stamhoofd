import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import { Group, LimitedFilteredRequest, PaginatedResponseDecoder } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { useRequestOwner } from './useRequestOwner';

export function useGetGroups() {
    const context = useContext();
    const owner = useRequestOwner();

    const getGroups = async (groupIds: string[], shouldRetry?: boolean) => {
        if (groupIds.length === 0) {
            return [];
        }

        const uniqueIds = Formatter.uniqueArray(groupIds);

        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/groups',
            query: new LimitedFilteredRequest({
                limit: uniqueIds.length,
                filter: {
                    id: {
                        $in: uniqueIds,
                    },
                },
            }),
            decoder: new PaginatedResponseDecoder(new ArrayDecoder(Group as Decoder<Group>), LimitedFilteredRequest),
            owner,
            shouldRetry,
        });

        return response.data.results;
    };

    return getGroups;
}
