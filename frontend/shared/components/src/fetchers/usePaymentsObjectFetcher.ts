import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { assertSort, CountFilteredRequest, CountResponse, LimitedFilteredRequest, PaginatedResponseDecoder, PaymentGeneral, SortItemDirection, SortList } from '@stamhoofd/structures';
import { useContext } from '../hooks';
import { ObjectFetcher } from '../tables';
import { SessionContext } from '@stamhoofd/networking';
import { Ref } from 'vue';

type ObjectType = PaymentGeneral;

function extendSort(list: SortList): SortList {
    return assertSort(list, [{ key: 'createdAt', order: SortItemDirection.DESC }, { key: 'id' }]);
}

export function getPaymentsObjectFetcher(context: Ref<SessionContext>, overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest): Promise<{ results: ObjectType[]; next?: LimitedFilteredRequest }> {
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/payments',
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(PaymentGeneral as Decoder<PaymentGeneral>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            return response.data;
        },

        async fetchCount(data: CountFilteredRequest): Promise<number> {
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/payments/count',
                decoder: CountResponse as Decoder<CountResponse>,
                query: data,
                shouldRetry: false,
                owner: this,
                timeout: 30 * 1000,
            });

            return response.data.count;
        },

        ...overrides,
    };
}

export function usePaymentsObjectFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();
    return getPaymentsObjectFetcher(context, overrides);
}
