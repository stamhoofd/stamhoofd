import { ArrayDecoder, Decoder } from "@simonbackx/simple-encoding";
import { assertSort, CountFilteredRequest, CountResponse, LimitedFilteredRequest, Organization, PaginatedResponseDecoder, SortList } from "@stamhoofd/structures";
import { useContext } from "../hooks";
import { ObjectFetcher } from "../tables";

type ObjectType = Organization;

function extendSort(list: SortList): SortList  {
    return assertSort(list, [{key: 'id'}])
}

export function useOrganizationsObjectFetcher(overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const context = useContext();

    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest) {
            console.log('Organizations.fetch', data);

            const response = await context.value.authenticatedServer.request({
                method: "GET",
                path: "/admin/organizations",
                decoder: new PaginatedResponseDecoder(new ArrayDecoder(Organization as Decoder<Organization>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                query: data,
                shouldRetry: false,
                owner: this
            });
    
            console.log('[Done] Organizations.fetch', data, response.data);
            
            return response.data
        },
    
        async fetchCount(data: CountFilteredRequest): Promise<number> {
            console.log('Organizations.fetchCount', data);
    
            const response = await context.value.authenticatedServer.request({
                method: "GET",
                path: "/admin/organizations/count",
                decoder: CountResponse as Decoder<CountResponse>,
                query: data,
                shouldRetry: false,
                owner: this
            })
    
            console.log('[Done] Organizations.fetchCount', data, response.data.count);
            return response.data.count
        },
        ...overrides
    }
}
