import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { LimitedFilteredRequest, PaginatedResponseDecoder, SortItemDirection } from '@stamhoofd/structures';
import { UserNotification } from '@stamhoofd/structures/notifications/UserNotification.js';
import { useContext } from '#hooks/useContext.ts';
import type { ObjectFetcher } from '#tables/classes/ObjectFetcher.ts';

type ObjectType = UserNotification;

export function useNotificationsObjectFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();

    return {
        // The endpoint only supports the newest first
        extendSort: () => [{ key: 'id', order: SortItemDirection.DESC }],

        async fetch(data: LimitedFilteredRequest): Promise<{ results: ObjectType[]; next?: LimitedFilteredRequest }> {
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/notifications',
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(UserNotification as Decoder<UserNotification>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            return response.data;
        },

        async fetchCount(): Promise<number> {
            throw new Error('Method not implemented.');
        },

        ...overrides,

        get requiredFilter() {
            return overrides?.requiredFilter ?? null;
        },
    };
}
